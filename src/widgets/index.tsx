import { 
  declareIndexPlugin, 
  ReactRNPlugin, 
  AppEvents, 
  RichTextInterface, 
} from '@remnote/plugin-sdk';
import { log } from '../lib/logging';
import '../style.css';
import '../App.css';

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

  plugin.event.addListener(AppEvents.EditorTextEdited, undefined, async (newText: RichTextInterface) => {
    const inputText = await plugin.richText.toString(newText);
    const text = inputText.trimEnd();

    log(plugin, "text:"+text);

    // For custom rule
    const ruleCustom = String(
      await plugin.settings.getSetting("rule_custom")
    );
    if (ruleCustom.length > 0) {
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
      if (text.charAt(text.length - 1) == '》' && text.charAt(text.length - 2) == '》') {
        await plugin.editor.deleteCharacters(2, -1);
        await plugin.editor.insertMarkdown(">>");
      } else if (text.charAt(text.length - 1) == '《' && text.charAt(text.length - 2) == '《') {
        await plugin.editor.deleteCharacters(2, -1);
        await plugin.editor.insertMarkdown("<<");
      }
    }

    // For auto space
    const ruleSpace = Boolean(
      await plugin.settings.getSetting("rule_space")
    );
    if (ruleSpace) {
      let patternMap = new Map([
        ["english", "[A-Za-z0-9\\~!@#\$%\^&\(\)\_\+-={}']+"],
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

      function addSpace(tokens: [string, string][]): [number, string] {
        if (tokens.length < 3) {
          return [0, ""];
        }
        const [left, mid, right] = tokens.slice(tokens.length - 3);
        const delNum = left[1].length + mid[1].length + right[1].length;
        if ((left[0] == 'chinese' && mid[0] == 'english' && right[0] == 'chinese') ) {
          return [delNum, left[1] + ' ' + mid[1] + ' ' + right[1]];
        } else if (left[0] == 'english' && mid[0] == 'chinese' && right[0] == 'english') {
          return [delNum, left[1] + ' ' + mid[1] + right[1]];
        } 
        return [0, ""];
      }
      
      do {
        let preBlackList: string[] = await plugin.storage.getSession("blackList");
        if (preBlackList != undefined && preBlackList.includes(text)) {
          break;
        }
        const tokens = parse(text);
        log(plugin, "tokens: " + JSON.stringify(tokens));
        const [delNum, newText] = addSpace(tokens);
        log(plugin, "newText: " + newText);
        if (delNum > 0) {
          let blackList: string[] = [];
          var base = tokens[0][1];
          log(plugin, "base: " + base);
          blackList.push(base);
          for (let item of text.substring(base.length)) {
            base += item
            blackList.push(base);
          }
          log(plugin, "blacklist: " + JSON.stringify(blackList));
          await plugin.storage.setSession("blackList", blackList);
          await plugin.editor.deleteCharacters(delNum, -1);
          await plugin.editor.insertMarkdown(newText);
        }
      } while(false);
    }
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
