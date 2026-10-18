// Separate key preference: do not migrate/extend the legacy 16-slot game config.
'use strict';
const STBinding = Object.freeze({
  defaultCode:'KeyA',
  valid(code) { return typeof code==='string' && /^(Key[A-Z]|Digit[0-9]|F[1-9]|F1[0-2]|Arrow(Left|Right|Up|Down)|Space|Shift(Left|Right)|Enter|Backspace|Tab)$/.test(code); },
  resolve(storage,used) {
    const code=storage.getItem('stAdviceKey') || this.defaultCode;
    return this.valid(code) && !used.includes(code) ? code : null;
  },
  textEntry(target) {
    return Boolean(target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));
  },
});
