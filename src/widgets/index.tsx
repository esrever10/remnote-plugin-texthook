import { 
  declareIndexPlugin, 
  ReactRNPlugin, 
  AppEvents, 
  RichTextInterface, 
  useTracker
} from '@remnote/plugin-sdk';
import { log } from '../lib/logging';
import '../style.css';
import '../App.css';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.settings.registerStringSetting({
    id: "rule",
    title: "Rule",
    defaultValue: "》》::>>,》》》::>>>,：：::\:\:,：：：::\:\:\:,；；::;;,；；；::;;;,《《::<<,！！::!!,￥￥::$$,-》::->",
  });

  // const rule = useTracker(
  //   async (reactivePlugin) =>
  //     await reactivePlugin.settings.getSetting("rule")
  // ) as string;

  plugin.event.addListener(AppEvents.EditorTextEdited, undefined, async (newText: RichTextInterface) => {
    const inputText = await plugin.richText.toString(newText);
    log(plugin, inputText);
    
    const widgetCtx = await plugin.widget.getWidgetContext();
    const dimension = await plugin.widget.getDimensions(widgetCtx["widgetInstanceId"]);
    log(plugin, JSON.stringify(widgetCtx));
    log(plugin, JSON.stringify(dimension));
    if (inputText == "》》") {
      await plugin.editor.deleteCharacters(2, -1);
      await plugin.editor.insertMarkdown(">>");
    }
  });
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
