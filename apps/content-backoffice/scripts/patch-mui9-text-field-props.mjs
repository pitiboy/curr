/**
 * react-admin 5.15.4 still passes TextField props that MUI 9 removed
 * (`InputProps`, `inputProps`, `InputLabelProps`). MUI forwards them to the
 * DOM, and React warns on the transaction list filters. The same props are
 * already copied into `slotProps` for MUI 6+, so this only drops the legacy
 * names on that path.
 *
 * Upstream fix: marmelab/react-admin@cbebbcd (not in 5.15.4). Skip when the
 * installed build no longer contains the old call.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../node_modules/ra-ui-materialui/dist',
);

const autocompleteFrom = `const mergedTextFieldProps = {
                    readOnly,
                    ...params.InputProps,
                    ...TextFieldProps?.InputProps,
                };
                // @ts-expect-error slotProps do not yet exist in MUI v5
                const mergedSlotProps = TextFieldProps?.slotProps
                    ? {
                        slotProps: {
                            // @ts-expect-error slotProps do not yet exist in MUI v5
                            ...TextFieldProps?.slotProps,
                            input: {
                                readOnly,
                                ...params.InputProps,
                                // @ts-expect-error slotProps do not yet exist in MUI v5
                                ...TextFieldProps?.slotProps?.input,
                            },
                        },
                    }
                    : undefined;`;

const autocompleteTo = (major) => `const { InputProps: paramsInputProps, inputProps: paramsHtmlInputProps, InputLabelProps: paramsInputLabelProps, slotProps: paramsSlotProps, ...textFieldParams } = params;
                const { InputProps: userInputProps, inputProps: userHtmlInputProps, InputLabelProps: userInputLabelProps, slotProps: userSlotProps, ...textFieldProps } = TextFieldProps ?? {};
                const input = {
                    readOnly,
                    ...paramsInputProps,
                    ...paramsSlotProps?.input,
                    ...userInputProps,
                    ...userSlotProps?.input,
                };
                const htmlInput = {
                    ...paramsHtmlInputProps,
                    ...paramsSlotProps?.htmlInput,
                    ...userHtmlInputProps,
                    ...userSlotProps?.htmlInput,
                };
                const inputLabel = {
                    ...paramsInputLabelProps,
                    ...paramsSlotProps?.inputLabel,
                    ...userInputLabelProps,
                    ...userSlotProps?.inputLabel,
                };
                const mergedSlotProps = ${major} >= 6
                    ? {
                        slotProps: {
                            ...paramsSlotProps,
                            ...userSlotProps,
                            input,
                            htmlInput,
                            inputLabel,
                        },
                    }
                    : {
                        InputProps: input,
                        inputProps: htmlInput,
                        InputLabelProps: inputLabel,
                    };`;

export const replacements = [
  {
    file: 'input/ResettableTextField.js',
    from: 'React.createElement(StyledTextField, { value: value, InputProps: inputProps, disabled: disabled || readOnly, variant: variant, margin: margin, className: className, ...rest, ...(muiMajor >= 6 ? { slotProps: mergedSlotProps } : {}), inputRef: ref })',
    to: 'React.createElement(StyledTextField, { value: value, disabled: disabled || readOnly, variant: variant, margin: margin, className: className, ...rest, ...(muiMajor >= 6 ? { slotProps: mergedSlotProps } : { InputProps: inputProps }), inputRef: ref })',
  },
  {
    file: 'input/ResettableTextField.cjs',
    from: 'React.createElement(StyledTextField, { value: value, InputProps: inputProps, disabled: disabled || readOnly, variant: variant, margin: margin, className: className, ...rest, ...(material_1.major >= 6 ? { slotProps: mergedSlotProps } : {}), inputRef: ref })',
    to: 'React.createElement(StyledTextField, { value: value, disabled: disabled || readOnly, variant: variant, margin: margin, className: className, ...rest, ...(material_1.major >= 6 ? { slotProps: mergedSlotProps } : { InputProps: inputProps }), inputRef: ref })',
  },
  {
    file: 'input/DateInput.js',
    from: 'InputLabelProps: defaultInputLabelProps, ...sanitizeInputRestProps(rest), ...(muiMajor >= 6 ? { slotProps: mergedSlotProps } : {})',
    to: '...sanitizeInputRestProps(rest), ...(muiMajor >= 6 ? { slotProps: mergedSlotProps } : { InputLabelProps: defaultInputLabelProps })',
  },
  {
    file: 'input/DateInput.cjs',
    from: 'InputLabelProps: defaultInputLabelProps, ...(0, sanitizeInputRestProps_1.sanitizeInputRestProps)(rest), ...(material_1.major >= 6 ? { slotProps: mergedSlotProps } : {})',
    to: '...(0, sanitizeInputRestProps_1.sanitizeInputRestProps)(rest), ...(material_1.major >= 6 ? { slotProps: mergedSlotProps } : { InputLabelProps: defaultInputLabelProps })',
  },
  {
    file: 'input/NumberInput.js',
    from: 'margin: margin, inputProps: inputProps, ...sanitizeInputRestProps(rest), ...(muiMajor >= 6 ? { slotProps: mergedSlotProps } : {})',
    to: 'margin: margin, ...sanitizeInputRestProps(rest), ...(muiMajor >= 6 ? { slotProps: mergedSlotProps } : { inputProps: inputProps })',
  },
  {
    file: 'input/NumberInput.cjs',
    from: 'margin: margin, inputProps: inputProps, ...(0, sanitizeInputRestProps_1.sanitizeInputRestProps)(rest), ...(material_1.major >= 6 ? { slotProps: mergedSlotProps } : {})',
    to: 'margin: margin, ...(0, sanitizeInputRestProps_1.sanitizeInputRestProps)(rest), ...(material_1.major >= 6 ? { slotProps: mergedSlotProps } : { inputProps: inputProps })',
  },
  {
    file: 'input/AutocompleteInput.js',
    from: autocompleteFrom,
    to: autocompleteTo('muiMajor'),
  },
  {
    file: 'input/AutocompleteInput.js',
    from: '...params, ...TextFieldProps, InputProps: mergedTextFieldProps, ...mergedSlotProps',
    to: '...textFieldParams, ...textFieldProps, ...mergedSlotProps',
  },
  {
    file: 'input/AutocompleteInput.cjs',
    from: autocompleteFrom,
    to: autocompleteTo('material_1.major'),
  },
  {
    file: 'input/AutocompleteInput.cjs',
    from: '...params, ...TextFieldProps, InputProps: mergedTextFieldProps, ...mergedSlotProps',
    to: '...textFieldParams, ...textFieldProps, ...mergedSlotProps',
  },
];

export function applyReplacement(code, from, to) {
  if (!code.includes(from)) return code;
  return code.replace(from, to);
}

export function patchMui9TextFieldProps(distDir = dist) {
  if (!fs.existsSync(distDir)) return [];
  const changed = [];
  for (const replacement of replacements) {
    const file = path.join(distDir, replacement.file);
    if (!fs.existsSync(file)) continue;
    const code = fs.readFileSync(file, 'utf8');
    const next = applyReplacement(code, replacement.from, replacement.to);
    if (next === code) continue;
    fs.writeFileSync(file, next);
    changed.push(replacement.file);
  }
  return changed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const changed = patchMui9TextFieldProps();
  if (changed.length > 0) {
    console.log(`patched ra-ui-materialui for MUI 9 (${changed.length} edits)`);
  }
}
