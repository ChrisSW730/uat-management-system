import { Search, Briefcase, ClipboardCheck, Plus, CalendarDays } from "lucide-react";
import "../styles/Projects.css";
import ProjectCard from "./ProjectCard";
import TestPlanCard from "./TestPlanCard";
import FilterDropdown from "./ui/FilterDropdown";
import { useState, useEffect } from "react";
import TimelineModal from "./timeline/TimelineModal";


export default function Projects(props) {
    const {
        canManageProjects,
        canDelete,
        projects,
        defects,
        selectedProjectId,
        setSelectedProjectId,
        selectedTestPlanId,
        setSelectedTestPlanId,
        selectedProject,
        selectedProjectPlans,
        setShowAddProject,
        setShowAddPlan,
        getTimelineMeta,
        timelineBadgeStyle,
        formatTimeline,
        setEditingProjectId,
        setEditProjectName,
        setEditProjectStartDate,
        setEditProjectEndDate,
        setShowEditProject,
        setEditingPlanId,
        setEditPlanName,
        setEditPlanStartDate,
        setEditPlanEndDate,
        setShowEditPlan,
        deleteProject,
        deleteTestPlan,
        toInputDate,
        setNewTC,
        setActiveTab,
        openManageScopes,
    } = props;

    const [searchText, setSearchText] = useState("");

    const [statusFilter, setStatusFilter] = useState("All");
    const [showTimelineModal, setShowTimelineModal] = useState(false);

    const statusOptions = [
        { value: "All", label: "All" },
        { value: "Not started", label: "Not started" },
        { value: "In progress", label: "In progress" },
        { value: "Completed", label: "Completed" }
    ];

    const filteredProjects = projects

        .filter(project => {

            const tm = getTimelineMeta(
                project.startDate,
                project.endDate
            );

            const matchSearch =
                project.name
                    ?.toLowerCase()
                    .includes(searchText.toLowerCase());

            const matchStatus =
                statusFilter === "All" ||
                tm.status === statusFilter;

            return matchSearch && matchStatus;

        })
        .sort((a, b) => b.id - a.id);

    useEffect(() => {

        if (filteredProjects.length === 0) {

            setSelectedProjectId("");
            setSelectedTestPlanId("");
            return;

        }

        const exists = filteredProjects.some(
            p => String(p.id) === String(selectedProjectId)
        );

        if (!exists) {

            setSelectedProjectId(
                String(filteredProjects[0].id)
            );

            setSelectedTestPlanId("");

        }

    }, [filteredProjects, selectedProjectId]);

    const openTimeline = () => {
        setShowTimelineModal(true);
    };

    const closeTimeline = () => {
        setShowTimelineModal(false);
    };

    const openProjectFromTimeline = (project) => {
        setSelectedProjectId(String(project.id));
        setSelectedTestPlanId("");
        closeTimeline();
    };

    const openTestPlanFromTimeline = (project, plan) => {
        setSelectedProjectId(String(project.id));
        setSelectedTestPlanId(String(plan.id));
        setNewTC(p => ({ ...p, testScopeId: "" }));
        setActiveTab("testcases");
        closeTimeline();
    };

    return (
        <div className="projects-page">

            <div className="projects-toolbar">

                {/* Left Side */}
                <div className="toolbar-left">
                    <div className="filter-wrapper">
                        <FilterDropdown
                            value={statusFilter}
                            onChange={setStatusFilter}
                            options={statusOptions}
                            placeholder="All"
                        />
                    </div>
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Search project..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>

                    <div className="view-toggle" role="tablist" aria-label="Projects view mode">
                        <button
                            type="button"
                            className={`view-toggle-btn ${showTimelineModal ? "active" : ""}`}
                            role="tab"
                            aria-selected={showTimelineModal}
                            title="View all Projects & Test Plans on a timeline"
                            onClick={openTimeline}
                        >
                            <CalendarDays size={15} />
                            Timeline View
                        </button>
                    </div>


                </div>

                {/* Right Side */}
                <div className="toolbar-right">

                    {canManageProjects && (
                        <button
                            className="primary-btn"
                            onClick={() => setShowAddProject(true)}
                        ><Plus size={16} />
                            Add Project
                        </button>
                    )}

                    {canManageProjects && (
                        <button
                            className="secondary-btn"
                            disabled={!selectedProjectId}
                            onClick={() => setShowAddPlan(true)}
                        >
                            <Plus size={16} />
                            Add Test Plan
                        </button>
                    )}


                </div>

            </div>

            <div className="project-layout">

                <div className="left-panel">

                    <div className="panel-header">
                        <div className="panel-title">
                            <Briefcase size={18} />
                            Projects
                            <span className="badge">
                                {filteredProjects.length}
                            </span>
                        </div>
                    </div>

                    <div className="panel-body">

                        {projects.length === 0 &&
                            <div className="empty-state">
                                <p>No projects found.</p>
                                <p>Click "Add Project" to create a project.</p>
                            </div>
                        }

                        {projects.length > 0 && filteredProjects.length === 0 &&
                            <div className="empty-state">
                                No projects match the current filters.
                            </div>
                        }

                        {filteredProjects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                selectedProjectId={selectedProjectId}
                                setSelectedProjectId={setSelectedProjectId}
                                setSelectedTestPlanId={setSelectedTestPlanId}
                                canManageProjects={canManageProjects}
                                canDelete={canDelete}
                                getTimelineMeta={getTimelineMeta}
                                timelineBadgeStyle={timelineBadgeStyle}
                                formatTimeline={formatTimeline}
                                setEditingProjectId={setEditingProjectId}
                                setEditProjectName={setEditProjectName}
                                setEditProjectStartDate={setEditProjectStartDate}
                                setEditProjectEndDate={setEditProjectEndDate}
                                setShowEditProject={setShowEditProject}
                                deleteProject={deleteProject}
                                toInputDate={toInputDate}
                            />
                        ))}

                    </div>

                </div>

                <div className="right-panel">

                    <div className="panel-header">
                        <div className="panel-title">
                            <ClipboardCheck size={18} />
                            Test Plans
                            {selectedProject && " - " + selectedProject.name}
                            <span className="badge">
                                {selectedProjectPlans.length}
                            </span>
                        </div>
                    </div>

                    <div className="panel-body">

                        {!selectedProject &&
                            <div className="empty-state">
                                Select a project to view test plans.
                            </div>
                        }

                        {selectedProjectPlans.map(tp => (
                            <TestPlanCard
                                key={tp.id}
                                tp={tp}
                                defects={defects}
                                selectedTestPlanId={selectedTestPlanId}
                                setSelectedTestPlanId={setSelectedTestPlanId}
                                setNewTC={setNewTC}
                                setActiveTab={setActiveTab}
                                getTimelineMeta={getTimelineMeta}
                                timelineBadgeStyle={timelineBadgeStyle}
                                formatTimeline={formatTimeline}
                                canManageProjects={canManageProjects}
                                canDelete={canDelete}
                                openManageScopes={openManageScopes}
                                setEditingPlanId={setEditingPlanId}
                                setEditPlanName={setEditPlanName}
                                setEditPlanStartDate={setEditPlanStartDate}
                                setEditPlanEndDate={setEditPlanEndDate}
                                setShowEditPlan={setShowEditPlan}
                                deleteTestPlan={deleteTestPlan}
                                toInputDate={toInputDate}
                            />
                        ))}

                    </div>

                </div>

            </div>

            <TimelineModal
                isOpen={showTimelineModal}
                onClose={closeTimeline}
                projects={filteredProjects}
                getTimelineMeta={getTimelineMeta}
                onProjectClick={openProjectFromTimeline}
                onTestPlanClick={openTestPlanFromTimeline}
            />

        </div>
    );
}
