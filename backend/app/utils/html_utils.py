def format_text_to_html_paragraphs(text: str) -> str:
    """Converts double newlines to HTML paragraph blocks and single newlines to <br/> tags."""
    if not text:
        return ""
    return "".join(
        f"<p>{para.replace(chr(10), '<br/>')}</p>"
        for para in text.split("\n\n")
    )
