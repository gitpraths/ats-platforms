import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";

interface Props {
  label: string;
  value: string[];
  onChange: (skills: string[]) => void;
}

export default function SkillsInput({ label, value, onChange }: Props) {
  const [input, setInput] = useState("");

  function addSkill() {
    const skill = input.trim();
    if (skill && !value.includes(skill)) onChange([...value, skill]);
    setInput("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(); }
    if (e.key === "Backspace" && !input && value.length > 0)
      onChange(value.slice(0, -1));
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 border rounded-lg p-2 min-h-[42px] focus-within:ring-2 focus-within:ring-blue-500">
        {value.map((s) => (
          <span key={s} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs rounded px-2 py-0.5">
            {s}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== s))}>
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={addSkill}
          placeholder={value.length === 0 ? "Type and press Enter" : ""}
          className="flex-1 min-w-[120px] outline-none text-sm"
        />
      </div>
    </div>
  );
}
