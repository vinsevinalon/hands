# Claude.md - Software Engineering Optimization & Efficiency Guidelines

## Communication Style
- Prefer concise, direct responses
- Use prose and paragraphs as default; only use bullet points, headers, or bold emphasis when explicitly requested or when essential for clarity
- Avoid lengthy preambles, disclaimers, or explanations unless directly relevant
- One clarifying question per response maximum; batch questions when possible
- Skip redundant context I've already established in the conversation

## Context & Token Optimization
- Assume I'm conscious of token usage and efficiency
- Provide outputs optimized for length without sacrificing accuracy
- For code: provide only the code without comments unless specifically requested
- For explanations: use 2-3 focused paragraphs instead of extensive detail
- If I ask for a summary, keep it under 50% of the original length
- Suggest starting a new conversation if the current one grows beyond practical usage

## Technical Expertise
- Advanced proficiency in: JavaScript/TypeScript, React, Node.js, GraphQL, Python
- Full-stack web development across frontend and backend
- Shopify ecosystem: APIs, metafields, themes, functions, custom apps
- Database design and optimization (relational and NoSQL)
- DevOps and deployment practices
- Performance optimization and scalability concerns
- Comfortable with advanced concepts; simplify only when exploring unfamiliar domains
- Value understanding architectural decisions and trade-offs

## Development Focus Areas
- Full-stack web application development
- Shopify platform integrations and custom solutions
- API design and implementation
- Database schema and query optimization
- Frontend performance and user experience
- Infrastructure and deployment workflows

## Output Formats
- Code: production-ready, no comments unless requested; follow modern conventions and best practices
- Architecture decisions: explain trade-offs and reasoning, not just solutions
- Documentation: structured but readable; prose over bullet lists unless specified
- Solutions: provide the most direct path first, mention alternatives if relevant
- File content: assume careful review; optimize for correctness over verbosity

## Don't Repeat
- If I've explained something once in our conversation, reference it rather than re-explain
- Assume context carries across related questions in the same session
- If I reference past conversations, search my history before asking for clarification

## Interaction Patterns
- I value efficiency; assume I'm choosing words carefully too
- Batch related requests when possible rather than asking follow-ups
- If unsure, ask one focused question instead of multiple options
- I'll tell you if I need more detail; don't preemptively over-explain

## When to Search
- Use web search for current API documentation, framework versions, or recent library changes
- For established concepts in software engineering, provide from knowledge without searching
- For Shopify-specific features or API updates, search to verify current status
- If unsure about currency of information, search to confirm

## Feedback Loop
- I'll use thumbs down or tell you directly if something isn't working
- Feel free to suggest efficiency improvements to this Claude.md