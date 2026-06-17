# AI Bot Project

## Overview

AI Bot Project is a Node.js-based AI development assistant that can:

* Generate complete software projects from natural language descriptions.
* Maintain project context through persistent sessions.
* Continue working on previously created projects.
* Automatically reconstruct project sessions from existing source code.
* Apply AI-generated file modifications directly to disk.
* Automatically execute required terminal commands when project dependencies are missing.
* Track and manage multiple project sessions.

---

# Features

## 1. New Project Creation

When a user enters a new application idea:

* A new AI session is created.
* The session ID is stored.
* The AI generates the complete project structure.
* Required files and folders are created automatically.
* File contents are written automatically.

Example:

User:

Create a clipboard manager application for macOS.

Output:

* Project structure
* Source files
* Configuration files
* Dependency definitions

---

## 2. Existing Project Continuation

If a project already contains a valid `session_id.txt` file:

* The stored session ID is loaded.
* The AI continues the previous conversation.
* Existing project context is preserved.
* Incremental development becomes possible.

This prevents context loss between development sessions.

---

## 3. Automatic Session Recovery

Some older projects may not contain a `session_id.txt` file.

When:

* A project folder is selected.
* `session_id.txt` does not exist.

The system automatically:

1. Scans the entire project structure.
2. Reads important source files.
3. Generates a project summary.
4. Creates a new AI session.
5. Sends the reconstructed project context to the AI.
6. Stores the newly created session ID inside `session_id.txt`.

This allows older projects to be edited without manually recreating context.

---

## 4. Session Management

All sessions are stored inside:

```text
session_ids.json
```

Structure:

```json
[
  {
    "index": 1,
    "session_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "title": "Clipboard Manager"
  }
]
```

Stored data:

* Session index
* Session ID
* Session title

Benefits:

* Session history
* Project tracking
* Easy session recovery

---

## 5. Persistent Project Context

Each project folder contains:

```text
session_id.txt
```

Example:

```text
b36f4fe1-4659-4e36-baa5-8745a73fe3c1
```

Purpose:

* Connect project folder to AI conversation.
* Continue development without losing context.
* Maintain project memory across executions.

---

## 6. Automatic File Generation

The AI returns structured file definitions.

The system automatically:

* Creates folders.
* Creates files.
* Writes file contents.
* Updates existing files.

Supported file types include:

* JS
* TS
* JSON
* HTML
* CSS
* Python
* Markdown
* YAML
* Swift
* Dart
* C/C++
* And more

---

## 7. Automatic File Editing

When modifications are requested:

* Existing files are loaded.
* AI analyzes the current implementation.
* Only required changes are applied.
* Unrelated code remains untouched.

This enables iterative development workflows.

---

## 8. Automatic Dependency Installation

The AI can detect when dependencies are required.

Examples:

```bash
npm install express
```

```bash
npm install axios
```

```bash
pip install requests
```

```bash
pip install beautifulsoup4
```

```bash
brew install ffmpeg
```

The system:

1. Extracts required commands from the AI response.
2. Executes them automatically.
3. Waits for completion.
4. Continues project generation.

Benefits:

* Zero manual dependency installation.
* Faster project setup.
* Reduced user intervention.

---

## 9. Intelligent Project Reconstruction

When rebuilding context from an existing project:

The scanner analyzes:

* Folder structure
* Source files
* Package definitions
* Configuration files
* Documentation

Examples:

```text
package.json
requirements.txt
README.md
Dockerfile
```

The generated summary is sent to the AI before editing begins.

This enables accurate continuation of legacy projects.

---

## 10. AI Session Workflow

### New Project

```text
User Idea
    ↓
Create Session
    ↓
Generate Project
    ↓
Create Files
    ↓
Save Session
```

### Existing Project

```text
Select Folder
    ↓
Read session_id.txt
    ↓
Continue Existing Session
    ↓
Apply Changes
```

### Legacy Project

```text
Select Folder
    ↓
No session_id.txt Found
    ↓
Scan Project
    ↓
Generate Summary
    ↓
Create New Session
    ↓
Store session_id.txt
    ↓
Continue Development
```

---

# Project Goals

* AI-assisted software development
* Persistent project memory
* Legacy project recovery
* Automatic dependency installation
* Automated file generation
* Automated file editing
* Multi-project support
* Minimal manual intervention

---

# Future Improvements

Potential future enhancements:

* Git integration
* Automatic commits
* Rollback support
* Dependency update management
* Docker integration
* Multi-agent workflows
* Project testing automation
* CI/CD generation
* IDE plugins

---

# Requirements

* Node.js
* Odysseus API
* File system access
* Terminal access

Optional:

* Docker
* Git
* Python
* Homebrew (macOS)

---

# License

Private Project
