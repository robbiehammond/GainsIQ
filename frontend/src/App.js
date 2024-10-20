"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const react_router_dom_1 = require("react-router-dom");
const WorkoutTracker_1 = __importDefault(require("./WorkoutTracker")); // Make sure the path is correct
const LastMonthWorkouts_1 = __importDefault(require("./LastMonthWorkouts"));
const App = () => {
    return (react_1.default.createElement(react_router_dom_1.BrowserRouter, null,
        react_1.default.createElement(react_router_dom_1.Routes, null,
            react_1.default.createElement(react_router_dom_1.Route, { path: "/", element: react_1.default.createElement(WorkoutTracker_1.default, null) }),
            react_1.default.createElement(react_router_dom_1.Route, { path: "/last-month-workouts", element: react_1.default.createElement(LastMonthWorkouts_1.default, null) }))));
};
exports.default = App;
//# sourceMappingURL=App.js.map