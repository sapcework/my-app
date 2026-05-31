import '../../entities/category.dart';
import '../../repositories/category_repository.dart';

class AddCategoryUseCase {
  final CategoryRepository _repository;
  const AddCategoryUseCase(this._repository);

  Future<void> call({
    required String name,
    required int colorValue,
    required String iconName,
  }) =>
      _repository.save(
        Category(
          name: name,
          colorValue: colorValue,
          iconName: iconName,
          createdAt: DateTime.now(),
        ),
      );
}
