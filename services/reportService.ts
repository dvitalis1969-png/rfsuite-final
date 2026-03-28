import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AppState } from '../types';

export const generateFrequencyReportPdf = (state: AppState, projectName: string) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Frequency Coordination Report: ${projectName}`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    // Add Channel List Table
    if (state.frequencies && state.frequencies.length > 0) {
        doc.setFontSize(14);
        doc.text('Frequency Assignment List', 14, 45);
        
        const tableData = state.frequencies.map(f => [
            f.id,
            f.value.toFixed(3),
            f.label || 'N/A',
            f.type || 'Generic'
        ]);

        autoTable(doc, {
            startY: 50,
            head: [['ID', 'Frequency (MHz)', 'Label', 'Type']],
            body: tableData,
        });
    }

    // Add Compliance Statement
    const finalY = (doc as any).lastAutoTable.finalY || 60;
    doc.setFontSize(14);
    doc.text('Compliance Statement', 14, finalY + 15);
    doc.setFontSize(10);
    doc.text('This frequency plan has been coordinated based on the provided equipment profiles and thresholds.', 14, finalY + 22);
    doc.text('Users are responsible for verifying compliance with local regulatory requirements.', 14, finalY + 28);

    doc.save(`${projectName}_Frequency_Report.pdf`);
};

export const exportToCsv = (state: AppState, projectName: string) => {
    const headers = ['ID', 'Frequency (MHz)', 'Label', 'Type'];
    const rows = state.frequencies.map(f => [
        f.id,
        f.value.toFixed(3),
        f.label || 'N/A',
        f.type || 'Generic'
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${projectName}_Frequency_List.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
};
