export const metadata = {
    title: 'Room-Booking-System | Startseite', // Das ist der Titel im Browser-Tab
};


export default function Home() {
    return (
        <main className="p-8">
            <h1 className="text-3xl font-bold">
                Room Booking System
            </h1>

            <p className="mt-4 text-gray-600">
                Studienprojekt mit Next.js
            </p>
        </main>
    );
}
