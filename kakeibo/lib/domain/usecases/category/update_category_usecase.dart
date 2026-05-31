import '../../entities/category.dart';
import '../../repositories/category_repository.dart';

class UpdateCategoryUseCase {
  final CategoryRepository _repository;
  const UpdateCategoryUseCase(this._repository);

  Future<void> call(Category category) => _repository.save(category);
}
