const PDFDocument = require('pdfkit');

function buildPDF(dataCallback, endCallback, traderData) {
    const doc = new PDFDocument({ bufferPages: true, font: 'Courier' });
    doc.on('data', dataCallback);
    doc.on('end', endCallback);

    let date_time = traderData.date_created;

    doc.fontSize(15).text(`Current Trader Details - ${date_time}`);

    const title = [
        'Company Name: ',
        'Business Website: ',
        'Business Email Address: ',
        'Business Contact Number: ',
        'Business Address: ',
        'Business Country Location: ',
        'Business States Location: ',
        'Business City Location: ',
        'Trade Category: ',
        'Sub Category: ',
        'Minor Sub Category: ',
        'Tags: ',
        'Business Scale: ',
        'Global Region of operation: ',
        'Country of operation: ',
        'State of operation: ',
    ];

    const data = [
        traderData.business_name ? traderData.business_name : 'N/A',
        traderData.business_website ? traderData.business_website : 'N/A',
        traderData.business_email ? traderData.business_email : 'N/A',
        traderData.business_contact ? traderData.business_contact : 'N/A',
        traderData.business_address ? traderData.business_address : 'N/A',
        traderData.business_country ? traderData.business_country : 'N/A',
        traderData.business_states ? traderData.business_states : 'N/A',
        traderData.business_city ? traderData.business_city : 'N/A',
        traderData.trade_categories ? traderData.trade_categories : 'N/A',
        traderData.sub_categories ? traderData.sub_categories : traderData.business_sub_category_str,
        traderData.minor_sub_categories ? traderData.minor_sub_categories : traderData.business_minor_sub_category_str,
        traderData.tags ? traderData.tags : 'N/A',
        traderData.businessScale ? traderData.businessScale : 'N/A',
        traderData.region_of_operation ? traderData.region_of_operation : 'N/A',
        traderData.country_of_operation ? traderData.country_of_operation : 'N/A',
        traderData.state_of_operation ? traderData.state_of_operation : 'N/A',
    ];

    const dataSpace = [164, 167, 198, 214, 170, 215, 212, 205, 163, 156, 181, 109, 156, 216, 182, 177];

    let i,
        invoiceTableTop = 70;

    for (i = 0; i < 17; i++) {
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
