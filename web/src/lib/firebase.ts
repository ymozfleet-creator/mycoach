import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/** 本番プロジェクト（mycoach-c15ae）。Webアプリ用の公開設定値（秘密情報ではない） */
export const firebaseConfig = {
  apiKey: 'AIzaSyASnST0dVT_0qDFxuELauG-uOqJPH_32D8',
  authDomain: 'mycoach-c15ae.firebaseapp.com',
  projectId: 'mycoach-c15ae',
  storageBucket: 'mycoach-c15ae.firebasestorage.app',
  messagingSenderId: '716654384254',
  appId: '1:716654384254:web:af387e47a2288bbde5b42f',
}


export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
