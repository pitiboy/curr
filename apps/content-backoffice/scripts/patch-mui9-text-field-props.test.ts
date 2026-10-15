import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  applyReplacement,
  patchMui9TextFieldProps,
  replacements,
} from './patch-mui9-text-field-props.mjs';

const dist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../node_modules/ra-ui-materialui/dist',
);

describe('patchMui9TextFieldProps', () => {
  it('moves legacy TextField props onto slotProps for MUI 6+', () => {
    const resettable = replacements.find(
      (item) => item.file === 'input/ResettableTextField.js',
    );
    expect(resettable).toBeDefined();
    const next = applyReplacement(
      `before ${resettable!.from} after`,
      resettable!.from,
      resettable!.to,
    );
    expect(next).toContain(
      'muiMajor >= 6 ? { slotProps: mergedSlotProps } : { InputProps: inputProps }',
    );
    expect(next).not.toContain('InputProps: inputProps, disabled');
  });

  it('leaves the installed ra-ui-materialui build without the DOM leak', () => {
    expect(patchMui9TextFieldProps()).toEqual([]);
    const leaks = [
      'InputProps: inputProps, disabled',
      'InputProps: mergedTextFieldProps',
      'InputLabelProps: defaultInputLabelProps,',
      'inputProps: inputProps, ...sanitizeInputRestProps',
    ];
    for (const file of [
      'input/ResettableTextField.js',
      'input/AutocompleteInput.js',
      'input/DateInput.js',
      'input/NumberInput.js',
    ]) {
      const code = fs.readFileSync(path.join(dist, file), 'utf8');
      for (const leak of leaks) {
        expect(code, `${file} still has ${leak}`).not.toContain(leak);
      }
    }
  });
});
