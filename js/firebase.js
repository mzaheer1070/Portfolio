import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAiLRpNFC6khivuyKQHpSwa7I6iO43n4rs",
  authDomain: "weba2-7a1f0.firebaseapp.com",
  projectId: "weba2-7a1f0",
  storageBucket: "weba2-7a1f0.firebasestorage.app",
  messagingSenderId: "501356088445",
  appId: "1:501356088445:web:470b722431621db00c7514"
};

// Initialize Firebase & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Form submission handler
const contactForm = document.getElementById("contactForm");
if (contactForm) {
    contactForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById("name");
        const emailInput = document.getElementById("email");
        const messageInput = document.getElementById("message");
        const statusDiv = contactForm.querySelector(".form-status");
        const submitBtn = contactForm.querySelector("button[type='submit']");
        const charCount = contactForm.querySelector("[data-char-count]");

        const name = nameInput ? nameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const message = messageInput ? messageInput.value.trim() : "";

        if (!name || !email || !message) {
            if (statusDiv) {
                statusDiv.className = "form-status status-error";
                statusDiv.textContent = "Please fill in all required fields before submitting.";
            }
            return;
        }

        try {
            if (statusDiv) {
                statusDiv.className = "form-status status-loading";
                statusDiv.textContent = "Sending your message to Firestore...";
            }
            if (submitBtn) {
                submitBtn.disabled = true;
            }

            await addDoc(collection(db, "contacts"), {
                name: name,
                email: email,
                message: message,
                timestamp: new Date()
            });

            if (statusDiv) {
                statusDiv.className = "form-status status-success";
                statusDiv.textContent = "✓ Thank you! Your message has been sent successfully.";
            }

            contactForm.reset();
            if (charCount) {
                charCount.textContent = "0 / 500";
            }
        } catch (error) {
            console.error("Firestore submission error:", error);
            if (statusDiv) {
                statusDiv.className = "form-status status-error";
                statusDiv.textContent = "Failed to deliver message. Please try again or email directly.";
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
            }
        }
    });
}