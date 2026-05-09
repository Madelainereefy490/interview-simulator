# Contributing to Interview Simulator Pro

Thanks for your interest in contributing! Here's how to get started.

## Setup Development Environment

```bash
git clone https://github.com/paragsen/interview-simulator.git
cd interview-simulator
cp .env.example .env  # Add your API key
npm install && cd client && npm install && cd ..
npm start
```

## Making Changes

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Test locally with `npm start`
5. Commit: `git commit -m "Add: your feature description"`
6. Push: `git push origin feature/your-feature`
7. Open a Pull Request

## Code Style

- React functional components with hooks
- No TypeScript (plain JS for accessibility)
- Inline styles (no CSS modules)
- Server: Express with async/await

## What to Contribute

- Bug fixes
- New AI provider integrations
- UI/UX improvements
- Multi-language support
- Documentation improvements
- Test coverage

## Reporting Issues

Use GitHub Issues. Include:
- What you expected
- What actually happened
- Browser + OS
- Console errors (F12 → Console)
