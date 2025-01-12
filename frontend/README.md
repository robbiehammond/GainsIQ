# Overview
## Development 
### Making Components 
See `components/sample_button` for how to do this. In short, create a folder with the component logic and css, then you can import it elsewhere. Components should only be for clearly visible things; `models/` is where to put non-visual, more abstract things (i.e. data structures for things like a Set to submit to the API).


## Testing 
To ensure my real data isn't tampered with when testing I made a preprod endpoint at https://winhi1fmi8.execute-api.us-west-2.amazonaws.com/prod. Adding this line:
```
REACT_APP_API_URL_PREPROD=https://winhi1fmi8.execute-api.us-west-2.amazonaws.com/prod
```
to the `.env` file you need to make will make it so the preprod endpoint is used if you do `npm run build:preprod` or `npm run start:preprod`. Feel free to add trash data to this, it doesn't matter. As described in the top-level README, to make your own endpoint, you'll have to do a double deploy where REACT_APP_API_URL is set to the URL of your deployed backend.

## Redux 
This app uses redux for frontend state management. I use good ol actions/reducers rather than the new slices simply due to familiarity. Adding complex components will likely require (or at least benefit from) the usage of redux. Mostly for the sake of example, I integrated the weight unit (lbs or kg) with redux. 

See `UnitReducer.ts` for how this works. It takes an <b>action</b>, which itself is just a value associated with a type (in this case, `SET_UNIT_WEIGHT`). The goal of the reducer is, when given an action, do what's needed to update some value in the redux store (update the `WeightUnit` field of the initial `WeightUnitState`). Exactly what it does is based on the type included in the action (hence the switch statement).

After the reducer and actions are defined, in the frontend code, we can now always retrieve the value like so. This can be used anywhere in the codebase and the the value will be the same everywhere:
```
  const dispatch = useDispatch();
  const unit = useSelector((state: RootState) => state.weightUnit.weightUnit);
  ```

state.weightUnit is a field of type `WeightUnitState`, which itself has a weightUnit, hence the repetition. To update the value, we can do something like the following:
```
dispatch(setWeightUnit(value as 'lbs' | 'kg'))
```
`setWeightUnit` is defined in `UnitActions.ts`. All it does is wrap the value in an object that also includes a type (`SET_WEIGHT_UNIT`). The type is important; this is because when you call `dispatch(action)`, that action is effectively sent to every single reducer configured with Redux (see the combinedReducer in index.ts in the store directory). By including the type and having reducers match on it, we can make only certain reducers do state updates (i.e. the reducers that include the type in the switch statement. So in this case, the weightUnitReducer).

