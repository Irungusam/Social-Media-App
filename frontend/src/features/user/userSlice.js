import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    value: null
}

const userSlice = createSlice({
    name: 'User',
    initialState,
    reducers: {

    }
})

export default userSlice.reducer