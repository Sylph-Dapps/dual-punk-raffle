import React from 'react';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import './App.scss';

const router = createBrowserRouter([
  { path: "*", Component: Root },
]);

function Root() {
  return (
    <div className="App">
      A Punk For You And Me
    </div>
  );
};

function App() {
  return <RouterProvider router={router} />;
}

export default App;
