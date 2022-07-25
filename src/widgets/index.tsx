import { 
  declareIndexPlugin, 
  ReactRNPlugin, 
  AppEvents, 
  RichTextInterface, 
} from '@remnote/plugin-sdk';
import { log } from '../lib/logging';
import '../style.css';
import '../App.css';

let patternMap = new Map([
  ["english", "[A-Za-z0-9~!@#\$%\^&\(\)\_\*\+-=\{\}\\\\\|\.'\"\?\[]+"],
  ["chinese", "[\u2E80-\u9FFF]+"],
])

function getTokenPattern(char:string) {
  if (char == ' ') {
    return "space";
  }
  const patterns = Array.from(patternMap.keys());
  for (const p of patterns) {
    if (new RegExp(patternMap.get(p)!).test(char)) {
      return p
    }
  }
  return "others";
}

function parse(text: string) {
  if (text.length == 0) {
    return []
  }
  let res: [string, string][] = [];
  var lastPattern = getTokenPattern(text.charAt(0));
  var buffer = text.charAt(0);
  var c = 1;
  while (c <= text.length) {
    var newPattern = "";
    if (c < text.length) {
      newPattern = getTokenPattern(text.charAt(c));            
    }
    if (newPattern != lastPattern) {
      res.push([lastPattern!, buffer]);
      buffer = text.charAt(c);
      lastPattern = newPattern;
    } else {
      buffer = buffer.concat(text.charAt(c));
    }
    c += 1
  }
  return res;
}

function mergeTokensText(tokens: [string, string][]) {
  var buffer = '';
  for (const token of tokens) {
    buffer += token[1];
  }
  return buffer;
}

function addSpaces(tokens: [string, string][]) {
  if (tokens.length < 2) {
    return mergeTokensText(tokens);
  }
  var res = tokens[0][1];
  var lIndex = 0;
  var cIndex = 1;
  while (cIndex < tokens.length) {
    const last = tokens[lIndex];
    const current = tokens[cIndex];
    if ((last[0] == 'chinese' && current[0] == 'english') || last[0] == 'english' && current[0] == 'chinese') {
      res += " " + current[1];
    } else {
      res += current[1];
    }
    lIndex = cIndex;
    cIndex += 1;
  }
  return res;
}

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerBooleanSetting({
    id: "rule_>>",
    title: "Chinese character conversion：》》to >> and《《 to <<",
    defaultValue: true,
  });

  await plugin.settings.registerBooleanSetting({
    id: "rule_space",
    title: "Auto add a space between Chinese and English",
    defaultValue: true,
  });

  await plugin.settings.registerStringSetting({
    id: "rule_custom",
    title: "Custom rule of text hook. (e.g. btw::By the way, AH::At home, one rule one line)",
    defaultValue: "",
    multiline: true,
  });

  await plugin.app.registerCommand({
    id: `addspaces`,
    name: `Add spaces`,
    keyboardShortcut: `ctrl+1`,
    action: async () => {
      const remId = await plugin.focus.getFocusedRemId();
      const rem = await plugin.rem.findOne(remId);
      const text = await plugin.richText.toMarkdown(rem?.text!);
      const {anchor, focus} = await plugin.editor.getSelection();
      log(plugin, `anchor: ${anchor}, focus: ${focus}`)
      await plugin.storage.setSession("unspacedText", text.slice(0, anchor));
      await plugin.editor.deleteCharacters(anchor);
    },
  });
  
  plugin.event.addListener(AppEvents.EditorTextEdited, undefined, async (newText: RichTextInterface) => {
    // For custom rule
    const ruleCustom = String(
      await plugin.settings.getSetting("rule_custom")
    );
    if (ruleCustom.length > 0) {
      var text = await plugin.richText.toMarkdown(newText);
      const rules = ruleCustom.split("\n");
      for (const rule of rules) {
        const [src, dst] = rule.split("::");
        // log(plugin, `${text}, ${src}, ${text.includes(src)}`);
        if (text.includes(src, text.length - src.length)) {
          await plugin.editor.deleteCharacters(src.length, -1);
          await plugin.editor.insertMarkdown(dst);
          break;
        }
      }
    }

    // For Chinese 》》
    const rule1 = Boolean(
      await plugin.settings.getSetting("rule_>>")
    );
    if (rule1) {
      var text = await plugin.richText.toString(newText);
      text = text.trimEnd();
      if (text.charAt(text.length - 1) == '》' && text.charAt(text.length - 2) == '》') {
        await plugin.editor.deleteCharacters(2, -1);
        await plugin.editor.insertMarkdown(">>");
      } else if (text.charAt(text.length - 1) == '《' && text.charAt(text.length - 2) == '《') {
        await plugin.editor.deleteCharacters(2, -1);
        await plugin.editor.insertMarkdown("<<");
      }
    }  

    const {anchor, focus} = await plugin.editor.getSelection();
    log(plugin, `anchor: ${anchor}, focus: ${focus}`)
    // For add space
    const unspacedText:string = await plugin.storage.getSession("unspacedText");

    function process(unspacedText: string) {
      const tokens = parse(unspacedText);
      log(plugin, "tokens: " + JSON.stringify(tokens));
      const spacedText = addSpaces(tokens)!;
      log(plugin, "spacedText: " + spacedText);
      return spacedText;
    }  
    log(plugin, "unspacedText: " + unspacedText);
    if (unspacedText) {
      var text = await plugin.richText.toMarkdown(newText);
      log(plugin, "text:" + text);
      if (text == "") {
        await plugin.editor.insertMarkdown(process(unspacedText));
        await plugin.storage.setSession("unspacedText", null);
      } else if (unspacedText.endsWith(text)) {
        await plugin.editor.insertMarkdown(process(unspacedText.slice(0, unspacedText.length - text.length)));
        await plugin.storage.setSession("unspacedText", null);
      }
    }
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
