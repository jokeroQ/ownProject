// Share placement behavior with the .app-date-popper styles, including short viewports.
export const datePickerPopperOptions = {
  modifiers: [{ name: 'preventOverflow', options: { padding: 12, altAxis: true, tether: false } }],
};
