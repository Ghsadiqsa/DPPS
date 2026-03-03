import { NextRequest, NextResponse } from "next/server";
import { ERPType, EntityType, generateCSVTemplate, generateTemplateDataArray } from "@/lib/erp-templates";
import * as xlsx from "xlsx";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const erp = searchParams.get("erp") as ERPType;
    // Support both entity and entityType for broad compatibility
    const entityType = (searchParams.get("entityType") || searchParams.get("entity")) as EntityType;
    const format = (searchParams.get("format") || "csv").toLowerCase();

    if (!erp || !entityType) {
        return NextResponse.json({ error: "Missing erp or entityType parameter" }, { status: 400 });
    }

    try {
        const headers = new Headers();

        if (format === "excel" || format === "xlsx") {
            const dataArray = generateTemplateDataArray(erp, entityType);
            const worksheet = xlsx.utils.aoa_to_sheet(dataArray);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "Template");

            // Generate buffer
            const excelBuffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

            headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            headers.set("Content-Disposition", `attachment; filename="${erp.toLowerCase()}_${entityType.toLowerCase()}_template.xlsx"`);

            return new NextResponse(excelBuffer, {
                status: 200,
                headers,
            });
        } else {
            // Default CSV
            const csvContent = generateCSVTemplate(erp, entityType);
            headers.set("Content-Type", "text/csv");
            headers.set("Content-Disposition", `attachment; filename="${erp.toLowerCase()}_${entityType.toLowerCase()}_template.csv"`);

            return new NextResponse(csvContent, {
                status: 200,
                headers,
            });
        }
    } catch (error) {
        console.error("Error generating template:", error);
        return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
    }
}
