import docx

doc = docx.Document('docs/WVA CRM Testing_latest_Updated.docx')

paragraphs_to_delete = [
    "Few Other Questions",
    "Migration to our Server",
    "Need to go through Excel Sync",
    "Sub Domain crm.workvision.com.au",
    "Link to Website on Footer",
    "Mobile Optimisation",
    "Send Bulk Email to Candidates",
    "Send Bulk Vacancies to Providers"
]

for p in doc.paragraphs:
    for text_to_delete in paragraphs_to_delete:
        if text_to_delete in p.text:
            p._element.getparent().remove(p._element)
            break

doc.save('docs/WVA CRM Testing_latest_Updated.docx')
print("Successfully removed the specified section.")
