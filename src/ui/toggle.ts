// src/ui/toggle.ts

export function createToggle(opts: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const el = document.createElement("label");
  el.className = "toggle";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = opts.value;

  const text = document.createElement("span");
  text.textContent = opts.label;

  input.addEventListener("change", () => opts.onChange(input.checked));

  el.append(input, text);
  return {
    el,
    setValue(value: boolean) { input.checked = value; },
  };
}
