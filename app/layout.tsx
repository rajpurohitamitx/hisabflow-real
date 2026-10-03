import "./globals.css";
import type { Metadata } from "next";
export const metadata:Metadata={title:"Hisab Flow — One conversation with your business",description:"AI-native business operating system for Indian businesses."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
