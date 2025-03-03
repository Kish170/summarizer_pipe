# Ultimate Note Taker

## Description
Ultimate Note Taker is a powerful and user-friendly application designed to help you take, organize, and manage your notes efficiently. Whether you're a student, professional, or just someone who loves to jot down ideas, this tool is perfect for you. The inspiration from this project came from my own personal hurdle where I didn't like taking notes during lectures or watching videos or sometimes just in general. This hackathon with Screenpipe, an application that captures contextual data from laptops/desktops like screen data and speaker audio, helped me tackle this hurdle. Using Screenpipe's app and SDK I was capable of developing an ai-powered application that generates notes based on your OCR data or realtime audio. But that's not it you can summarize notes based on topics, and search or delete notes and export the notes as txt files. There is much more I would love to add to this project such as exporting to external document applications such as Google docs and Notion but automating the task through the click of a button. I wasn't able to get to this because Screenpipe hasn't added UI context capturing and input control to the Windows application. Nonetheless I am looking forward to it and everything else that Screenpipe aspires to build.

## Tech Stack
- **Frontend:** Next.js
- **Backend:** Bun
- **Database:** Dexie.js
- **Styling:** Tailwind CSS, ShadCN
- **Technologies:** Screenpipe
- **AI Models:** GPT 4.o from ScreenPipe Cloud

## Features
- **AI-Generated Notes:** Used GPT 4.o to generate notes from OCR data or audio data
- **Note-Management:** Used Dexie.js to store notes locally allowing for users to always have access to it locally
- **Organization:** Notes are organized and categorized by tags
- **Search & Filter Notes:** With a local database users can search notes by tags 
- **No need for Authentication or Authorization:** Since it is all stored locally users data are safe with them and they no longer have to deal with authentication
-**Summarizer:** Used GPT 4.o to generate a summarized note of all notes with the chosen tag

## Future Progressions:
- **Connect to External Note Applications:** When users click an export button automate using screenpipes currently experimental feature of UI context and input control
- **Better Note Management:** Store it in an actual database and connect it using an ORM possibly Prisma with PostgreSQL
- **Improve Interactivity:** Improve interactivity in screenpipes app by allowing to edit notes, train model on creating better notes and better present notes

## How to Try It Out
1. Clone the repository:
    ```bash
    git clone https://github.com/Kish170/summarizer_pipe
    ```
2. Navigate to the project directory:
    ```bash
    cd summarizer_pipe
    ```
3. Install dependencies:
    ```bash
    bun install
    ```
4. Start the development server:
    ```bash
    bun dev
    ```
5. Open your browser and go to `http://localhost:3000` to see the application in action and let me know your thoughts!

## Credits
- **Project Lead:** Kishan Rajagunathas
- **Contributors:** ScreenPipe
- **Special Thanks:** CEO of ScreenPipe, Louis Beaumont and CoFounder of ScreenPipe, Matthew Diakonow 
