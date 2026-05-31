import '../../repositories/category_repository.dart';

class DeleteCategoryUseCase {
  final CategoryRepository _repository;
  const DeleteCategoryUseCase(this._repository);

  Future<void> call(int id) => _repository.delete(id);
}
