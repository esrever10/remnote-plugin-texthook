import { 
    RichTextCardDelimiterInterface, RichTextLatexInterface,
  } from '@remnote/plugin-sdk';

export class RichTextCardDelimiter implements RichTextCardDelimiterInterface {
    i: 's';
    delimiterCharacterForSerialization?: string | undefined;
    constructor(delimiter: string | undefined) {
        this.i = 's';
        this.delimiterCharacterForSerialization = delimiter;
    }

}

export class RichTextLatex implements RichTextLatexInterface {
    i: 'x';
    text: string;
    block?: boolean;
    constructor(text: string, block?: boolean) {
        this.i = 'x';
        this.text = text;
        this.block = block;
    }

}