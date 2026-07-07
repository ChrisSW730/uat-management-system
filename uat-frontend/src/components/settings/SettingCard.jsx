import { ChevronRight } from "lucide-react";

export default function SettingCard({
    icon,
    title,
    description,
    count,
    badge,
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
                        <span className="badge">
                            {badge}
                        </span>
                    )}

                </div>

            </div>

        </div>
    );
}