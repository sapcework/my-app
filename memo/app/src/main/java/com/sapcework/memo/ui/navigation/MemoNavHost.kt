package com.sapcework.memo.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.sapcework.memo.ui.screen.edit.MemoEditScreen
import com.sapcework.memo.ui.screen.edit.MemoEditViewModel
import com.sapcework.memo.ui.screen.list.MemoListScreen
import com.sapcework.memo.ui.screen.settings.SettingsScreen
import com.sapcework.memo.ui.screen.tag.TagScreen
import com.sapcework.memo.ui.screen.trash.TrashScreen

@Composable
fun MemoNavHost(modifier: Modifier = Modifier, navController: NavHostController = rememberNavController()) {
    NavHost(
        navController = navController,
        startDestination = MemoDestination.List.route,
        modifier = modifier,
    ) {
        composable(MemoDestination.List.route) {
            MemoListScreen(
                onMemoClick = { id -> navController.navigate(MemoDestination.Edit.createRoute(id)) },
                onCreateClick = {
                    navController.navigate(
                        MemoDestination.Edit.createRoute(MemoEditViewModel.NEW_MEMO_ID),
                    )
                },
                onTrashClick = { navController.navigate(MemoDestination.Trash.route) },
                onTagsClick = { navController.navigate(MemoDestination.Tags.route) },
                onSettingsClick = { navController.navigate(MemoDestination.Settings.route) },
            )
        }

        composable(
            route = MemoDestination.Edit.route,
            arguments = listOf(
                navArgument(MemoEditViewModel.ARG_MEMO_ID) {
                    type = NavType.LongType
                    defaultValue = MemoEditViewModel.NEW_MEMO_ID
                },
            ),
        ) {
            MemoEditScreen(
                onBack = { navController.popBackStack() },
                onDeleted = { navController.popBackStack() },
            )
        }

        composable(MemoDestination.Trash.route) {
            TrashScreen(onBack = { navController.popBackStack() })
        }

        composable(MemoDestination.Tags.route) {
            TagScreen(onBack = { navController.popBackStack() })
        }

        composable(MemoDestination.Settings.route) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
}
