import {
    ClipboardList,
    CalendarDays,
    Bug,
    Target,
    Pencil,
    Trash2
} from "lucide-react";

export default function TestPlanCard({

    tp,

    defects,

    selectedTestPlanId,

    setSelectedTestPlanId,

    setNewTC,

    setActiveTab,

    getTimelineMeta,

    timelineBadgeStyle,

    formatTimeline,

    canManageProjects,

    canDelete,

    openManageScopes,

    setEditingPlanId,

    setEditPlanName,

    setEditPlanStartDate,

    setEditPlanEndDate,

    setShowEditPlan,

    deleteTestPlan,

    toInputDate

}) {

    const selected =
        String(selectedTestPlanId) === String(tp.id);

    const tm = getTimelineMeta(
        tp.startDate,
        tp.endDate
    );

    const badge =
        timelineBadgeStyle(tm.status);

    const bugCount =
        defects.filter(
            d => String(d.testPlanId) === String(tp.id)
        ).length;

    return (

        <div

            className={`testplan-card ${
                selected ? "selected" : ""
            }`}

            onClick={() => {

                setSelectedTestPlanId(
                    String(tp.id)
                );

                setNewTC(p => ({
                    ...p,
                    testScopeId: ""
                }));

                setActiveTab("testcases");

            }}

        >

            {/* Header */}

            <div className="tp-header">

                <div className="tp-icon">

                    <ClipboardList size={20} />

                </div>

                <div style={{ flex: 1 }}>

                    <div className="tp-title">

                        {tp.name}

                    </div>

                                    <div
                   style={{
                            color:"#94a3b8",
                            fontSize:13,
                            marginTop:2,
                            fontWeight:700
                        }}
                >

                    Plan #{tp.id}

                </div>

                </div>

                {bugCount > 0 && (

                    <div className="bug-pill">

                        <Bug size={15} />

                        {bugCount}

                    </div>

                )}

            </div>

            {/* Timeline */}

            <div

                className="timeline-pill"

                style={{

                    background: badge.bg,

                    color: badge.text,

                    border: `1px solid ${badge.border}`,

                    marginTop: 20,

                    marginBottom: 18

                }}

            >

                <CalendarDays size={14} />

                {formatTimeline(

                    tp.startDate,

                    tp.endDate

                )}

            </div>

            {/* Progress */}

            <div className="progress-wrapper">

                <div className="progress-bar">

                    <div

                        className="progress-fill"

                        style={{

                            width: `${tm.progress}%`,

                            background: tm.color

                        }}

                    />

                </div>

                <div className="progress-info">

                    <span
                        style={{
                            color: tm.color
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

            <div className="tp-footer">

    <span>
    </span>

    <div className="tp-actions">

        {canManageProjects && (

            <button
                className="icon-button"
                title="Manage Scope"
                onClick={(e)=>{

                    e.stopPropagation();

                    openManageScopes(tp);

                }}
            >
                <Target size={16}/>
            </button>

        )}

        {canManageProjects && (

            <button
                className="icon-button"
                title="Edit"
                onClick={(e)=>{

                    e.stopPropagation();

                    setEditingPlanId(tp.id);

                    setEditPlanName(tp.name);

                    setEditPlanStartDate(
                        toInputDate(tp.startDate)
                    );

                    setEditPlanEndDate(
                        toInputDate(tp.endDate)
                    );

                    setShowEditPlan(true);

                }}
            >
                <Pencil size={16}/>
            </button>

        )}

        {canDelete && (

            <button
                className="icon-button delete"
                title="Delete"
                onClick={(e)=>{

                    e.stopPropagation();

                    if(window.confirm(`Delete "${tp.name}"?`)){

                        deleteTestPlan(tp.id);

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