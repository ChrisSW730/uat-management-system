import { ChevronLeft, ChevronRight } from "lucide-react";
import "../../styles/Pagination.css";

export default function Pagination({
    totalItems,
    currentPage,
    pageSize,
    setCurrentPage,
    setPageSize,
    pageSizeOptions = [10, 20, 50, 100],
}) {

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const start = totalItems === 0
        ? 0
        : (currentPage - 1) * pageSize + 1;

    const end = Math.min(currentPage * pageSize, totalItems);

    const pages = [];

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
        pages.push(
            <button
                key={1}
                className={`page-btn ${currentPage === 1 ? "active" : ""}`}
                onClick={() => setCurrentPage(1)}
            >
                1
            </button>
        );

        if (startPage > 2) {
            pages.push(
                <span key="start-dot" className="page-dots">
                    ...
                </span>
            );
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(
            <button
                key={i}
                className={`page-btn ${currentPage === i ? "active" : ""}`}
                onClick={() => setCurrentPage(i)}
            >
                {i}
            </button>
        );
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pages.push(
                <span key="end-dot" className="page-dots">
                    ...
                </span>
            );
        }

        pages.push(
            <button
                key={totalPages}
                className={`page-btn ${currentPage === totalPages ? "active" : ""}`}
                onClick={() => setCurrentPage(totalPages)}
            >
                {totalPages}
            </button>
        );
    }

    return (
        <div className="table-footer">

            <div className="table-info">
                Showing {start}-{end} of {totalItems}
            </div>

            <div className="pagination-wrapper">

    <div className="pagination-center">

        <button
    className="page-nav-btn"
    disabled={currentPage === 1}
    onClick={() => setCurrentPage(currentPage - 1)}
>
    <ChevronLeft size={18} />
    <span>Previous</span>
</button>

{pages}

<button
    className="page-nav-btn"
    disabled={currentPage === totalPages}
    onClick={() => setCurrentPage(currentPage + 1)}
>
    <span>Next</span>
    <ChevronRight size={18} />
</button>

    </div>

    <div className="page-size">
        <span>Rows per page:</span>

        <select
            value={pageSize}
            onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
            }}
        >
            {pageSizeOptions.map(size => (
                <option key={size} value={size}>
                    {size}
                </option>
            ))}
        </select>
    </div>

</div>

        </div>
    );
}