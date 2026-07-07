import { ChevronRight } from "lucide-react";

export default function SettingCard({
    icon,
    title,
    description,
    count,
    badge,
    badgeColor,
    onClick,
}) {
    const Icon = icon;

    return (
        <div
            className="setting-card"
            onClick={onClick}
        >
            <div className="setting-card-header">

                <div className="setting-icon">
                    <Icon size={28} strokeWidth={2} />
                </div>

                <ChevronRight
                    size={18}
                    className="setting-arrow"
                />

            </div>

            <div className="setting-content">

                <h3>{title}</h3>

                <p>{description}</p>

                <div className="setting-footer">

                    {count && (
                        <span className="item-count">
                            {count} Items
                        </span>
                    )}

                    {badge && (
                        <span
                            className="badge"
                            style={badgeColor === "green"
                                ? { background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }
                                : undefined}
                        >
                            {badge}
                        </span>
                    )}

                </div>

            </div>

        </div>
    );
}