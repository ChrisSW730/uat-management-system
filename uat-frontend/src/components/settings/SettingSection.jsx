import SettingCard from "./SettingCard";
import "../../styles/Settings.css";

export default function SettingSection({ title, cards }) {
    return (
        <section className="setting-section">
            <h2>{title}</h2>

            <div className="setting-grid">
                {cards.map((card) => (
                    <SettingCard
                        key={card.title}
                        {...card}
                        onClick={card.onClick}
                    />
                ))}
            </div>
        </section>
    );
}