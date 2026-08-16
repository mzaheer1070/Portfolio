# Portfolio

> A modern, high-performance, and responsive portfolio website showcasing web applications, API tooling, and interactive projects.

🔗 **Live Demo:** https://mzaheer1070.github.io/Portfolio/

---

## 📌 About

This is a personal portfolio website featuring web development projects, API integrations, live dashboards, and a functional contact system powered by Firebase Firestore.

---

## ✨ Features

| Feature                  | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| 🎨 Modern UI & Design    | Fluid HSL design tokens with polished dark/light theme    |
| 🔤 Google Typography     | Plus Jakarta Sans & JetBrains Mono for crisp readability  |
| 📱 Responsive Layout     | Fully optimized across mobile, tablet, and widescreen     |
| 🔥 Firebase Contact Form | Contact messages stored securely using Firestore          |
| 🌤️ Weather Dashboard    | Real-time weather data with geolocation & 5-day forecast  |
| 📊 API Dashboard         | Real HTTP API monitoring with response status and latency |
| ✅ Todo Application       | Task management with browser persistence                  |
| 📂 Project Showcase      | Organized collection of live standalone projects          |
| 🏷️ Version Control      | Semantic versioning with Git tags                         |
| 🚀 CI/CD Deployment      | Automatic deployment using GitHub Actions                 |

---

## 🛠️ Tech Stack

### Frontend

* HTML5 (Semantic & Accessible)
* CSS3 (Vanilla CSS, HSL Tokens, Glassmorphism, Responsive Grid/Flex)
* JavaScript (ES6+ Modules, IntersectionObserver, Animations)
* Google Fonts (Plus Jakarta Sans & JetBrains Mono)

### Backend / Services

* Firebase Firestore
* OpenWeatherMap API
* Public REST APIs

### Development Tools

* Git & GitHub
* GitHub Actions (CI/CD)
* VS Code / GitHub Codespaces

### Hosting

* GitHub Pages

---

## 📁 Project Structure

```
Portfolio/
│
├── index.html
├── about.html
├── projects.html
├── contact.html
├── README.md
│
├── css/
│   └── style.css
│
├── js/
│   ├── script.js
│   ├── firebase.js
│   └── portfolio-links.js
│
├── Images/
│   └── MEss.jpeg
│
├── projects/
│   ├── weather-app/
│   ├── weather-dashboard/
│   ├── todo-app/
│   ├── api-dashboard/
│   └── shared/
│
└── .github/
    └── workflows/
        └── static.yml
```

---

## 🏷️ Version History

| Version    | Release Notes                                                                |
| ---------- | ---------------------------------------------------------------------------- |
| **v3.1.0** | Add live weather-scene animations to the dashboard |
| **v3.0.0** | Major UI redesign, HSL dark/light design system, Google typography, privacy updates, and MEss profile |
| **v2.1.3** | Fix: Use OpenWeatherMap reverse geocoding for accurate city detection               |
| **v2.1.2** | Update projects page - reorder projects and open Weather Dashboard in new tab       |
| **v2.1.1** | Fix: Correct geolocation to display Islamabad instead of Allahabad                  |
| **v2.1.0** | Add Weather Dashboard with live API integration and 5-day forecast                  |
| **v2.0.0** | Add Firebase Firestore contact form with form validation                            |
| **v1.0.0** | Initial portfolio release with GitHub Pages deployment                              |
---

## 🚀 Run Locally

Clone the repository:

```bash
git clone https://github.com/mzaheer1070/Portfolio.git
cd Portfolio
```

Start a local server:

```bash
python3 -m http.server 8000
```

Open:

```
http://localhost:8000
```

---

## 🔒 Security

* Firestore rules restrict database access.
* Contact submissions are create-only.
* Visitors cannot read, update, or delete submitted messages.

---

## 🤝 Feedback

Suggestions and improvements are welcome. Feel free to open an issue or share feedback about the project.

⭐ If you find this project interesting, consider giving it a star!
git
