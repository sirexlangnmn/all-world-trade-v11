const PDFDocument = require('pdfkit');

function buildPDF(dataCallback, endCallback, visitorData) {
    const doc = new PDFDocument({ bufferPages: true, font: 'Courier' });
    doc.on('data', dataCallback);
    doc.on('end', endCallback);

    let date_time = visitorData.date_created;

    doc.fontSize(15).text(`Current Visitor Details - ${date_time}`);

    const title = [
        'First Name: ',
        'Last Name: ',
        'Middle Name: ',
        'Country of Residence: ',
        'States of Residence: ',
        'City of Residence: ',
        'Languages of communication: ',
        'Email Address: ',
        'Social Media / Messaging App: ',
        'Mobile Number: ',
    ];

    const data = [
        visitorData.first_name,
        visitorData.last_name,
        visitorData.middle_name ? visitorData.middle_name : 'N/A',
        visitorData.country,
        visitorData.state,
        visitorData.city,
        visitorData.language,
        visitorData.email,
        visitorData.social_media_contact_type,
        visitorData.contact_number,
    ];

    const dataSpace = [144, 144, 155, 190, 180, 175, 230, 155, 230, 165];

    let i,
        invoiceTableTop = 70;

    for (i = 0; i < 11; i++) {
        const position = invoiceTableTop + (i + 1) * 30;
        generateTableRow(doc, position, title[i], data[i], dataSpace[i]);
    }
    doc.end();
}

function generateTableRow(doc, y, title, data, dataSpace) {
    doc.fontSize(12).font('Times-Roman').text(title, 75, y);

    doc.fontSize(12).font('Times-Bold').text(data, dataSpace, y);
}

module.exports = { buildPDF };
