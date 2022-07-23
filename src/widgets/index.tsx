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

    // log(plugin, "text:"+text);

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
    const ruleSpace = Boolean(
      await plugin.settings.getSetting("rule_space")
    );
    if (ruleSpace) {
      const englishPattern = new RegExp("[A-Za-z0-9]+");
      const chinesePattern = new RegExp("[\u4E00-\u9FA5]+");
  
      function getToken(text: string, index: number, pattern: RegExp) {
        var res = "";
        var c = index;
        while (c >= 0) {
          if (pattern.test(text.charAt(c))) {
            res += text.charAt(c);
          } else {
            break;
          }
          c -= 1;
        }
        return res.split('').reverse().join('')
      }
  
      do {
        let preBlackList: string[] = await plugin.storage.getSession("blackList");
        if (preBlackList != undefined && preBlackList.includes(text)) {
          // log(plugin, JSON.stringify(preBlackList));
          break;
        }
        // log(plugin, "--start--");
        var index = text.length - 1;
        const rightToken = getToken(text, index, chinesePattern);
        if (rightToken.length == 0) {
          break;
        }
  
        // log(plugin, "rightToken:"+rightToken+",index="+index);
        index -= rightToken.length;
        const englishToken = getToken(text, index, englishPattern);
        if (englishToken.length == 0) {
          break;
        }
        // log(plugin, "englishToken:"+englishToken+",index="+index);
        index -= englishToken.length;
        const leftToken = getToken(text, index, chinesePattern);
        if (leftToken.length == 0) {
          break;
        }
        // log(plugin, "leftToken:"+leftToken+",index="+index);
  
        var base = text.substring(0, index + 1);
        log(plugin, `base:${base}`);
        let blackList: string[] = [];
        blackList.push(base);
        for (let item of englishToken + rightToken) {
          base += item
          blackList.push(base);
        }
        await plugin.storage.setSession("blackList", blackList);
        log(plugin, JSON.stringify(blackList));
  
        const delNum = rightToken.length + englishToken.length;
        const addStr = " " + englishToken + " " + rightToken;
        // log(plugin, "wow:"+delNum+", "+addStr);
        await plugin.editor.deleteCharacters(delNum, -1);
        await plugin.editor.insertMarkdown(addStr);
        // await plugin.storage.setSession("blackList", []);
        break;
      } while(1);
    }
    
    
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
