import ReactDOM from 'react-dom/client';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';
import Layout from './Components/Layout';
import Landing from './Components/Landing';
import Home from './Components/Home';
import Room from './Components/Room/Room';
import { GoogleOAuthProvider } from '@react-oauth/google';
import AuthProvider from './Components/AuthProvider';

const router = createBrowserRouter([
    {
      element: <Layout/>,
      children: [
        { path: "/", element: <Landing/>},
        { path: "/home", element: <AuthProvider><Home/></AuthProvider>},
        { path: "/room/:roomID", element: <Room/>},
        /*{ path: "/account", element: <Account/>},
        ,
        */
      ]
        }
])

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <RouterProvider router = {router} />
      </GoogleOAuthProvider>
);