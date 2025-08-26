import { type I18nFlavor } from '@grammyjs/i18n';
import { Context, type SessionFlavor } from 'grammy';
import type { Game } from './lib/types';
type SessionData = {
    game: Game | undefined;
};
export type MyContext = Context & SessionFlavor<SessionData> & I18nFlavor;
declare const _default: (req: {
    headers: Record<string, string | string[] | undefined>;
    on: (event: string, listener: (chunk: unknown) => void) => /*elided*/ any;
    once: (event: string, listener: () => void) => /*elided*/ any;
}, res: {
    writeHead: {
        (status: number): /*elided*/ any;
        (status: number, headers: Record<string, string>): /*elided*/ any;
    };
    end: (json?: string) => void;
}) => Promise<void>;
export default _default;
//# sourceMappingURL=bot.d.ts.map