import { 
  declareIndexPlugin, 
  ReactRNPlugin, 
  AppEvents, 
  RichTextInterface,
  RichTextAnnotationInterface,
  RichTextElementTextInterface,
  RichTextElementInterface, 
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

function process(unspacedText: string) {
  const tokens = parse(unspacedText);
  const spacedText = addSpaces(tokens)!;
  return spacedText;
}

function richText2log(text: RichTextInterface) {
  const values = Array.from(text.values());
  return values.map((item) => {
    switch(item.i) {
      case undefined:
        return item;
      case 's':
        return `(s, ${item.delimiterCharacterForSerialization})`
      case 'm':
      case 'n':
      case 'x':
        return `(${item.i}, ${item.text})`
      default:
        return `(${item.i},)`
    }
  }).join(' | ');
}

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerBooleanSetting({
    id: "rule_ce_space",
    title: "Auto add a space between Chinese and English",
    defaultValue: true,
  });

  await plugin.settings.registerBooleanSetting({
    id: "rule_latex_space",
    title: "Auto put space on both sides of the latex block.",
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
      const ruleCEspace = Boolean(
        await plugin.settings.getSetting("rule_ce_space")
      );
      if (!ruleCEspace) {
        return;
      }

      const rem = await plugin.focus.getFocusedRem();
      addSpaces4Richtext(plugin, rem?.text!);
    }
  });

  async function addSpaces4Richtext(plugin: ReactRNPlugin, newText: RichTextInterface) {
    var items = Array.from(newText.values());
    var spaceCount = 0;
    const newItems = items.map(item => {
      if (!["m", "n", undefined].includes(item?.i)) {
        return item as RichTextElementInterface
      }
      var text = "";
      if (item?.i === undefined) {
        text = item as string;
        const spacedText = process(text);
        spaceCount += spacedText.length - text.length;
        return spacedText as RichTextElementInterface
      } else {
        text = (item as RichTextElementTextInterface | RichTextAnnotationInterface).text;
        const spacedText = process(text);
        spaceCount += spacedText.length - text.length;
        (item as RichTextElementTextInterface | RichTextAnnotationInterface).text = spacedText;
        return (item as RichTextElementInterface);
      }
    });
    await plugin.editor.setText(newItems);
    await plugin.editor.moveCaret(spaceCount, 1);
  }

  plugin.event.addListener(AppEvents.EditorTextEdited, undefined, async (newText: RichTextInterface) => {
    if (!newText) {
      return;
    }
    log(plugin, `newText: ${richText2log(newText)}`); 
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

    // For latex space rule
    const ruleLatexspace = Boolean(
      await plugin.settings.getSetting("rule_latex_space")
    );
    if (ruleLatexspace) {
      var items = Array.from(newText.values());
      if (items.length >= 3 && items.at(-1) === ' ' && items.at(-2)?.i === 'x' && items.at(-3)?.i === undefined && !(items.at(-3) as string).endsWith(" ")) {
        items.splice(-3, 1, items.at(-3) + " ");
        await plugin.editor.setText(items);
      } 
      items = Array.from(newText.values());
      if (items.length >= 2 && items.at(-1)?.i === undefined && !(items.at(-1) as string).startsWith(" ")) {
        items.splice(-1, 1, " " + items.at(-1));
        await plugin.editor.setText(items);
        await plugin.editor.moveCaret(1, 1);
      }
    }
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
