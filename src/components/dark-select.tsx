"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "cn";

export function DarkSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 160);
    const menuHeight = options.length * 36 + 10;
    const fitsBelow = rect.bottom + 4 + menuHeight < window.innerHeight;
    setPos({
      top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - menuHeight - 4),
      left: Math.min(rect.left, window.innerWidth - width - 8),
      width,
    });
  }, [options.length]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    place();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, place]);

  const label = options.find((option) => option.value === value)?.label ?? value;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-white/15 bg-[#12141a] px-2.5 text-left text-sm text-white"
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon className={cn("size-4 shrink-0 text-zinc-400", open && "rotate-180")} />
      </button>
      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-[200] cursor-default bg-transparent"
                onClick={() => setOpen(false)}
              />
              <div
                ref={menuRef}
                role="listbox"
                style={{
                  position: "fixed",
                  top: pos.top,
                  left: pos.left,
                  width: pos.width,
                  zIndex: 210,
                }}
                className="rounded-lg border border-white/15 bg-[#12141a] py-1 text-sm text-white shadow-xl"
              >
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    className={cn(
                      "flex w-full px-2.5 py-1.5 text-left text-white hover:bg-white/10",
                      option.value === value && "bg-white/10",
                    )}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
