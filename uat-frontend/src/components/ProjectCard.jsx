import {
    FolderKanban,
    CalendarDays,
    Pencil,
    Trash2
} from "lucide-react";

export default function ProjectCard({
    project,

    selectedProjectId,
    setSelectedProjectId,
    setSelectedTestPlanId,

    canManageProjects,
    canDelete,

    getTimelineMeta,
    timelineBadgeStyle,
    formatTimeline,

    setEditingProjectId,
    setEditProjectName,
    setEditProjectStartDate,
    setEditProjectEndDate,
    setShowEditProject,

    deleteProject,

    toInputDate
}) {

    const selected =
        String(selectedProjectId) === String(project.id);

    const tm = getTimelineMeta(
        project.startDate,
        project.endDate
    );

    const badge =
        timelineBadgeStyle(tm.status);

    return (

        <div
            className={`project-card ${
                selected ? "selected" : ""
            }`}
            onClick={() => {

                setSelectedProjectId(
                    String(project.id)
                );

                setSelectedTestPlanId("");

            }}
        >

            {/* Header */}

            <div className="project-header">

                <div className="project-icon">

                    <FolderKanban size={22}/>

                </div>

                <div
                    style={{
                        flex:1, fontWeight:700, fontSize:15
                    }}
                >

                    <div className="project-title">

                        {project.name}

                    </div>

                    <div
                        style={{
                            color:"#94a3b8",
                            fontSize:13,
                            marginTop:2
                        }}
                    >
                        Project ID #{project.id}

                    </div>

                </div>

            </div>

            {/* Timeline */}

            <div

                className="timeline-pill"

                style={{

                    background:badge.bg,

                    color:badge.text,

                    border:`1px solid ${badge.border}`

                }}

            >

                <CalendarDays size={14}/>

                {formatTimeline(

                    project.startDate,

                    project.endDate

                )}

            </div>

            {/* Progress */}

            <div className="progress-wrapper">

                <div className="progress-bar">

                    <div

                        className="progress-fill"

                        style={{

                            width:`${tm.progress}%`,

                            background:tm.color

                        }}

                    />

                </div>

                <div className="progress-info">

                    <span

                        style={{

                            color:tm.color

                        }}

                    >

                        {tm.status}

                    </span>

                    <span>

                        {tm.progress}%

                    </span>

                </div>

            </div>

            {/* Footer */}

            <div className="project-footer">

    <span>
    </span>

    <div className="project-actions">

        {canManageProjects && (

            <button
                className="icon-button"
                onClick={(e)=>{
                    e.stopPropagation();

                    setEditingProjectId(project.id);
                    setEditProjectName(project.name);
                    setEditProjectStartDate(toInputDate(project.startDate));
                    setEditProjectEndDate(toInputDate(project.endDate));
                    setShowEditProject(true);
                }}
            >
                <Pencil size={16}/>
            </button>

        )}

        {canDelete && (

            <button
                className="icon-button delete"
                onClick={(e)=>{
                    e.stopPropagation();

                    if(window.confirm(`Delete "${project.name}"?`)){
                        deleteProject(project.id);
                    }
                }}
            >
                <Trash2 size={16}/>
            </button>

        )}

    </div>

</div>

        </div>

    );

}