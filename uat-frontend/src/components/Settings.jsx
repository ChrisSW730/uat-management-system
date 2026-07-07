import SettingSection from "./settings/SettingSection";
import "../styles/Settings.css";
import {
    FolderKanban,
    Bug,
    FlaskConical,
    Link2,
    Bell,
    ShieldCheck,
    Settings2
} from "lucide-react";

export default function Settings({ categories, onManageCategories }) {
    return (
        <div className="settings-page">
            <div className="page-header">
            </div>

            <SettingSection
                title="Test Case Configuration"
                cards={[
                    {
                        icon: FolderKanban,
                        title: "Categories",
                        description: "Manage test case categories",
                        count: categories.length,
                        onClick: onManageCategories,
                    },
                ]}
            />

            <SettingSection
                title="Integrations"
                cards={[
                    {
                        icon: Link2,
                        title: "ClickUp Integration",
                        description: "Integrate with ClickUp to sync defects",
                        badge: "Not Connected",
                    },
                ]}
            />
        </div>
    );
}