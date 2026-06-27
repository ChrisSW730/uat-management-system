import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import "../../styles/Projects.css";

export default function FilterDropdown({
    value,
    options,
    placeholder,
    onChange
}) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () =>
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
    }, []);

    const selected =
        options.find(o => o.value === value)?.label ||
        placeholder;

    return (
        <div
            className="dropdown"
            ref={dropdownRef}
        >
            <button
                type="button"
                className="dropdown-btn"
                onClick={() => setOpen(!open)}
            >
                <span title={selected}>
                    {selected}
                </span>
                <ChevronDown size={16} />
            </button>

            {open && (
                <div className="dropdown-menu">
                    {options.map(option => (
                        <div
                            key={option.value}
                            className="dropdown-item"
                            onClick={() => {
                                onChange(option.value);
                                setOpen(false);
                            }}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}