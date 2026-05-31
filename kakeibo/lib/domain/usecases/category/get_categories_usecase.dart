import '../../entities/category.dart';
import '../../repositories/category_repository.dart';

class GetCategoriesUseCase {
  final CategoryRepository _repository;
  const GetCategoriesUseCase(this._repository);

  Stream<List<Category>> call() => _repository.watchAll();
}
