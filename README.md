# 🇺🇦xdAnswers

A free and open-source extension that helps you with tests using the power of artificial intelligence.

> [!IMPORTANT]  
> This project still in **BETA** testing. If you see bug, [create issue](https://github.com/aartzz/xdAnswers/issues) about it.

![A screenshot of the extension in action](images/README/ui.png) 
## 🚀 Key Features

* **AI-Powered Answers:** Get answers to test questions using advanced language models.
* **Multi-Service Support:** Integrates with MistralAI, OpenAI, Google Gemini, and local models via Ollama.
* **Image Recognition:** The extension can analyze images in both questions and answer options.
* **Convenient UI:** A floating helper window that you can move and resize.
* **Flexible Configuration:** Manage API keys, models, and system prompts through a user-friendly popup window.

## ⚙️ How to Install

**Step 1: Go to the Releases Page**

1.  Navigate to the **[Releases](https://github.com/aartzz/xdAnswers/releases)** page of this repository.
2.  Find the latest release, which will be marked with a `Latest` tag.

**Step 2: Download the Correct File for Your Browser**

Under the **Assets** section of the latest release, download the appropriate file:
* For **Chrome, Kiwi, or other Chromium browsers**, download the `xdAnswers-chrome-vX.X.X.zip` file.
* For **Firefox**, download the `xdAnswers-firefox-vX.X.X.xpi` file.

**Step 3: Install the File in Your Browser**

#### 🥝 Kiwi Browser (Android)

1.  Download the `...chrome...zip` file directly to your phone.
2.  Open Kiwi Browser, tap the three-dot menu, and select **Extensions**.
3.  Enable **Developer mode** using the toggle switch.
4.  Tap the **`+ (from .zip / .crx / .user.js)`** button.
5.  Using your phone's file manager, select the `.zip` file you just downloaded.
6.  Done! The extension is installed and ready to use.

#### 🖥️ Google Chrome (Desktop)

1.  Download the `...chrome...zip` file and **unzip it** into a new folder.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  In the top-right corner, enable **Developer mode**.
4.  Click the **Load unpacked** button that appears on the left.
5.  In the file selection window, choose the **folder you just unzipped**.
6.  Done! The extension's icon will appear in your toolbar.

#### 🦊 Mozilla Firefox (Desktop)

1.  Download the `...firefox...xpi` file.
2.  Open Firefox. The easiest way to install is to **drag and drop** the downloaded `.xpi` file directly onto any Firefox window.
3.  A prompt will appear asking for confirmation. Click **Add**.
4.  Done! The extension is now permanently installed.

---

### For Developers

This method is for those who want to modify the code or test the latest unreleased changes.

1.  Clone the repository or download the source code as a ZIP file and unzip it.
    ```bash
    git clone https://github.com/aartzz/xdAnswers.git
    ```
2.  Follow the "Load unpacked" instructions for your browser (Chrome or the "Temporary Add-on" method for Firefox) as described above, but select the source code folder you just cloned/downloaded.

## 💡 How to Use

1.  After installation, click the extension's icon in your browser's toolbar to open the settings.
2.  Select your preferred service (e.g., MistralAI).
3.  If the service requires an API key (like OpenAI or Gemini), paste it into the appropriate field.
4.  Click "Save and Close".
5.  Navigate to a test on one of the supported sites.
6.  The helper window will appear automatically and display the answer to the current question.

## ✅ Supported Sites

-   [🇺🇦 NaUrok](https://naurok.com.ua)
-   [🌐 Google Forms](https://docs.google.com/forms) [BETA]

## 📝 To-Do

-   Add support for Vseosvita, Kahoot, and other educational platforms.
-   Fix bugs and improve stability.
-   Add multi-language support for the UI.