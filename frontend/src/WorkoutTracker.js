"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const material_1 = require("@mui/material");
const colors_1 = require("@mui/material/colors");
// Create a custom theme
const theme = (0, material_1.createTheme)({
    palette: {
        primary: {
            main: colors_1.indigo[500],
        },
        secondary: {
            main: colors_1.amber[500],
        },
        background: {
            default: colors_1.teal[50],
        },
    },
    typography: {
        h4: {
            fontWeight: 'bold',
            color: colors_1.indigo[700],
        },
        h5: {
            color: colors_1.amber[800],
        },
    },
});
const WorkoutTracker = () => {
    const apiUrl = process.env.REACT_APP_API_URL || '';
    const [exercises, setExercises] = (0, react_1.useState)([]);
    const [searchTerm, setSearchTerm] = (0, react_1.useState)('');
    const [newExercise, setNewExercise] = (0, react_1.useState)('');
    const [selectedExercise, setSelectedExercise] = (0, react_1.useState)('');
    const [reps, setReps] = (0, react_1.useState)('');
    const [sets, setSets] = (0, react_1.useState)('');
    const [weight, setWeight] = (0, react_1.useState)('');
    const [unit, setUnit] = (0, react_1.useState)('lbs');
    const [confirmationMessage, setConfirmationMessage] = (0, react_1.useState)('');
    const [snackbarOpen, setSnackbarOpen] = (0, react_1.useState)(false);
    // Fetch exercises
    (0, react_1.useEffect)(() => {
        const fetchExercises = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const response = yield fetch(`${apiUrl}/workouts`);
                const data = yield response.json();
                setExercises(data || []);
            }
            catch (error) {
                console.error('Error fetching exercises:', error);
                setExercises([]);
            }
        });
        fetchExercises();
    }, [apiUrl]);
    // Filter exercises based on search term
    const filteredExercises = exercises.filter((exercise) => exercise.toLowerCase().includes(searchTerm.toLowerCase()));
    // Convert weight to pounds if in kg
    const convertToPounds = (weight, unit) => {
        return unit === 'kg' ? weight * 2.20462 : weight;
    };
    // Handle form submission to log a workout
    const handleSubmit = (e) => __awaiter(void 0, void 0, void 0, function* () {
        e.preventDefault();
        const convertedWeight = convertToPounds(parseFloat(weight), unit);
        const workoutData = {
            exercise: selectedExercise,
            reps: reps.toString(),
            sets: parseInt(sets),
            weight: convertedWeight,
        };
        try {
            const response = yield fetch(`${apiUrl}/workouts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(workoutData),
            });
            if (!response.ok) {
                throw new Error('Failed to log workout');
            }
            setConfirmationMessage(`Logged: Set number ${sets} for ${selectedExercise}, ${reps} rep(s) with ${convertedWeight.toFixed(2)} lbs`);
            setSnackbarOpen(true);
            setReps('');
            setSets('');
        }
        catch (error) {
            console.error('Error logging workout:', error);
        }
    });
    // Handle adding a new exercise
    const handleAddExercise = () => __awaiter(void 0, void 0, void 0, function* () {
        if (newExercise && !exercises.includes(newExercise)) {
            try {
                const response = yield fetch(`${apiUrl}/workouts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ exercise_name: newExercise }),
                });
                if (!response.ok) {
                    throw new Error('Failed to add exercise');
                }
                setExercises([...exercises, newExercise]);
                setNewExercise('');
            }
            catch (error) {
                console.error('Error adding exercise:', error);
            }
        }
        else {
            alert('Exercise already exists or is invalid');
        }
    });
    // Handle popping the last set
    const handlePopLastSet = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield fetch(`${apiUrl}/workouts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'pop_last_set' }),
            });
            if (!response.ok) {
                throw new Error('Failed to pop last set');
            }
            const message = yield response.text();
            setConfirmationMessage(message);
            setSnackbarOpen(true);
        }
        catch (error) {
            console.error('Error popping last set:', error);
        }
    });
    return (react_1.default.createElement(material_1.ThemeProvider, { theme: theme },
        react_1.default.createElement(material_1.Container, { maxWidth: "md", sx: { padding: '40px 20px' } },
            react_1.default.createElement(material_1.Paper, { elevation: 3, sx: { padding: '20px', backgroundColor: theme.palette.background.default } },
                react_1.default.createElement(material_1.Typography, { variant: "h4", align: "center", gutterBottom: true }, "Workout Tracker"),
                react_1.default.createElement("form", { onSubmit: handleSubmit },
                    react_1.default.createElement(material_1.Grid, { container: true, spacing: 3 },
                        react_1.default.createElement(material_1.Grid, { item: true, xs: 12 },
                            react_1.default.createElement(material_1.TextField, { fullWidth: true, label: "Search Exercise", variant: "outlined", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) })),
                        react_1.default.createElement(material_1.Grid, { item: true, xs: 12 },
                            react_1.default.createElement(material_1.FormControl, { fullWidth: true, required: true },
                                react_1.default.createElement(material_1.InputLabel, null, "Select Exercise"),
                                react_1.default.createElement(material_1.Select, { value: selectedExercise, onChange: (e) => setSelectedExercise(e.target.value), label: "Select Exercise" },
                                    react_1.default.createElement(material_1.MenuItem, { value: "" }, "-- Select an Exercise --"),
                                    filteredExercises.length > 0 ? (filteredExercises.map((exercise, index) => (react_1.default.createElement(material_1.MenuItem, { key: index, value: exercise }, exercise)))) : (react_1.default.createElement(material_1.MenuItem, { disabled: true }, "No exercises found"))))),
                        react_1.default.createElement(material_1.Grid, { item: true, xs: 12, sm: 6 },
                            react_1.default.createElement(material_1.FormControl, { fullWidth: true, required: true },
                                react_1.default.createElement(material_1.InputLabel, null, "Reps"),
                                react_1.default.createElement(material_1.Select, { value: reps, onChange: (e) => setReps(e.target.value), label: "Reps" },
                                    react_1.default.createElement(material_1.MenuItem, { value: "" }, "-- Select Reps --"),
                                    react_1.default.createElement(material_1.MenuItem, { value: "5 or below" }, "5 or below"),
                                    [...Array(12).keys()].map((n) => (react_1.default.createElement(material_1.MenuItem, { key: n, value: (n + 6).toString() }, n + 6))),
                                    react_1.default.createElement(material_1.MenuItem, { value: "16 or above" }, "16 or above")))),
                        react_1.default.createElement(material_1.Grid, { item: true, xs: 12, sm: 6 },
                            react_1.default.createElement(material_1.FormControl, { fullWidth: true, required: true },
                                react_1.default.createElement(material_1.InputLabel, null, "Set Number"),
                                react_1.default.createElement(material_1.Select, { value: sets, onChange: (e) => setSets(e.target.value), label: "Sets" },
                                    react_1.default.createElement(material_1.MenuItem, { value: "" }, "-- Select Set Number --"),
                                    [...Array(5).keys()].map((n) => (react_1.default.createElement(material_1.MenuItem, { key: n, value: (n + 1).toString() }, n + 1)))))),
                        react_1.default.createElement(material_1.Grid, { item: true, xs: 12, sm: 6 },
                            react_1.default.createElement(material_1.TextField, { fullWidth: true, label: "Weight", type: "number", value: weight, onChange: (e) => setWeight(e.target.value), required: true })),
                        react_1.default.createElement(material_1.Grid, { item: true, xs: 12, sm: 6 },
                            react_1.default.createElement(material_1.FormControl, { fullWidth: true, required: true },
                                react_1.default.createElement(material_1.InputLabel, null, "Unit"),
                                react_1.default.createElement(material_1.Select, { value: unit, onChange: (e) => {
                                        const value = e.target.value;
                                        if (value === 'lbs' || value === 'kg') {
                                            setUnit(value);
                                        }
                                    }, label: "Unit" },
                                    react_1.default.createElement(material_1.MenuItem, { value: "lbs" }, "Pounds (lbs)"),
                                    react_1.default.createElement(material_1.MenuItem, { value: "kg" }, "Kilograms (kg)")))),
                        react_1.default.createElement(material_1.Grid, { item: true, xs: 12 },
                            react_1.default.createElement(material_1.Button, { type: "submit", variant: "contained", color: "primary", fullWidth: true, sx: { backgroundColor: colors_1.indigo[600], '&:hover': { backgroundColor: colors_1.indigo[800] } } }, "Log Workout")),
                        react_1.default.createElement(material_1.Grid, { item: true, xs: 12 },
                            react_1.default.createElement(material_1.Button, { variant: "contained", color: "secondary", fullWidth: true, onClick: handlePopLastSet, sx: { backgroundColor: colors_1.amber[600], '&:hover': { backgroundColor: colors_1.amber[800] } } }, "Pop Last Set")))),
                react_1.default.createElement(material_1.Snackbar, { open: snackbarOpen, autoHideDuration: 4000, onClose: () => setSnackbarOpen(false) },
                    react_1.default.createElement(material_1.Alert, { onClose: () => setSnackbarOpen(false), severity: "success" }, confirmationMessage)),
                react_1.default.createElement(material_1.Card, { sx: { marginTop: '20px', backgroundColor: colors_1.amber[50] } },
                    react_1.default.createElement(material_1.CardContent, null,
                        react_1.default.createElement(material_1.Typography, { variant: "h5", gutterBottom: true }, "Add a New Exercise"),
                        react_1.default.createElement(material_1.Grid, { container: true, spacing: 2 },
                            react_1.default.createElement(material_1.Grid, { item: true, xs: 8 },
                                react_1.default.createElement(material_1.TextField, { fullWidth: true, label: "New Exercise", value: newExercise, onChange: (e) => setNewExercise(e.target.value) })),
                            react_1.default.createElement(material_1.Grid, { item: true, xs: 4 },
                                react_1.default.createElement(material_1.Button, { variant: "contained", color: "secondary", onClick: handleAddExercise, sx: { backgroundColor: colors_1.amber[700], '&:hover': { backgroundColor: colors_1.amber[900] } } }, "Add Exercise")))))))));
};
exports.default = WorkoutTracker;
//# sourceMappingURL=WorkoutTracker.js.map