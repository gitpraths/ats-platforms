/**
 * AI Service — powered by Anthropic Claude API
 * Model: claude-opus-4-6  (see CLAUDE.md)
 */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = "claude-opus-4-6";

/**
 * Generate a job description.
 * @param {string}   title
 * @param {string}   department
 * @param {string[]} requiredSkills
 * @param {string[]} desiredSkills
 * @param {string}   existingDesc  — optional partial description for context
 */
export async function generateJobDescription(title, department, requiredSkills = [], desiredSkills = [], existingDesc = "") {
  const skillsBlock = [
    requiredSkills.length ? `Required skills: ${requiredSkills.join(", ")}.` : "",
    desiredSkills.length  ? `Desired skills: ${desiredSkills.join(", ")}.`   : "",
    existingDesc          ? `Existing description context: ${existingDesc}.`  : "",
  ].filter(Boolean).join("\n");

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 1024,
    messages: [{
      role:    "user",
      content: `Write a professional job description for a "${title}" role in the ${department} department.
${skillsBlock}

Include:
- Role summary (2-3 sentences)
- Key responsibilities (5-7 bullet points)
- Required qualifications (4-5 bullet points)
- Preferred qualifications (2-3 bullet points)

Be concise and professional. Do not include salary or company name.`,
    }],
  });
  return response.content[0].text;
}

/**
 * Suggest 5 alternative job titles.
 * @param {string}   title
 * @param {string}   department
 * @param {string[]} skillsRequired
 * @param {string}   jobDesc
 */
export async function suggestJobTitles(title, department, skillsRequired = [], jobDesc = "") {
  const context = [
    skillsRequired.length ? `Skills: ${skillsRequired.join(", ")}.` : "",
    jobDesc               ? `Context: ${jobDesc.slice(0, 300)}.`     : "",
  ].filter(Boolean).join(" ");

  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 256,
    messages: [{
      role:    "user",
      content: `Suggest 5 alternative or related job titles for "${title}" in the ${department} department. ${context}
Return only a JSON array of strings, nothing else. Example: ["Title 1", "Title 2"]`,
    }],
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    // Fallback: try to extract array from text
    const match = response.content[0].text.match(/\[.*\]/s);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return [title];
  }
}

/**
 * Screen a candidate against a job.
 * @param {string} candidateNotes
 * @param {string} jobTitle
 * @param {string} jobDescription
 */
export async function screenCandidate(candidateNotes, jobTitle, jobDescription = "") {
  const response = await client.messages.create({
    model:      MODEL,
    max_tokens: 512,
    messages: [{
      role:    "user",
      content: `You are an ATS assistant. Review this candidate for the role of "${jobTitle}".

Job Description:
${jobDescription || "Not provided."}

Candidate Notes:
${candidateNotes}

Provide a brief screening summary (2-3 sentences) and a fit score from 1-10.
Return JSON only: { "summary": "...", "score": N }`,
    }],
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { summary: response.content[0].text, score: null };
  }
}
