// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'recurring_expense_model.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetRecurringExpenseModelCollection on Isar {
  IsarCollection<RecurringExpenseModel> get recurringExpenseModels =>
      this.collection();
}

const RecurringExpenseModelSchema = CollectionSchema(
  name: r'RecurringExpenseModel',
  id: 6832131763582375165,
  properties: {
    r'amount': PropertySchema(
      id: 0,
      name: r'amount',
      type: IsarType.double,
    ),
    r'categoryId': PropertySchema(
      id: 1,
      name: r'categoryId',
      type: IsarType.long,
    ),
    r'dayOfMonth': PropertySchema(
      id: 2,
      name: r'dayOfMonth',
      type: IsarType.long,
    ),
    r'isActive': PropertySchema(
      id: 3,
      name: r'isActive',
      type: IsarType.bool,
    ),
    r'lastRegisteredMonth': PropertySchema(
      id: 4,
      name: r'lastRegisteredMonth',
      type: IsarType.long,
    ),
    r'lastRegisteredYear': PropertySchema(
      id: 5,
      name: r'lastRegisteredYear',
      type: IsarType.long,
    ),
    r'name': PropertySchema(
      id: 6,
      name: r'name',
      type: IsarType.string,
    )
  },
  estimateSize: _recurringExpenseModelEstimateSize,
  serialize: _recurringExpenseModelSerialize,
  deserialize: _recurringExpenseModelDeserialize,
  deserializeProp: _recurringExpenseModelDeserializeProp,
  idName: r'id',
  indexes: {},
  links: {},
  embeddedSchemas: {},
  getId: _recurringExpenseModelGetId,
  getLinks: _recurringExpenseModelGetLinks,
  attach: _recurringExpenseModelAttach,
  version: '3.1.0+1',
);

int _recurringExpenseModelEstimateSize(
  RecurringExpenseModel object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.name.length * 3;
  return bytesCount;
}

void _recurringExpenseModelSerialize(
  RecurringExpenseModel object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeDouble(offsets[0], object.amount);
  writer.writeLong(offsets[1], object.categoryId);
  writer.writeLong(offsets[2], object.dayOfMonth);
  writer.writeBool(offsets[3], object.isActive);
  writer.writeLong(offsets[4], object.lastRegisteredMonth);
  writer.writeLong(offsets[5], object.lastRegisteredYear);
  writer.writeString(offsets[6], object.name);
}

RecurringExpenseModel _recurringExpenseModelDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = RecurringExpenseModel();
  object.amount = reader.readDouble(offsets[0]);
  object.categoryId = reader.readLong(offsets[1]);
  object.dayOfMonth = reader.readLong(offsets[2]);
  object.id = id;
  object.isActive = reader.readBool(offsets[3]);
  object.lastRegisteredMonth = reader.readLong(offsets[4]);
  object.lastRegisteredYear = reader.readLong(offsets[5]);
  object.name = reader.readString(offsets[6]);
  return object;
}

P _recurringExpenseModelDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readDouble(offset)) as P;
    case 1:
      return (reader.readLong(offset)) as P;
    case 2:
      return (reader.readLong(offset)) as P;
    case 3:
      return (reader.readBool(offset)) as P;
    case 4:
      return (reader.readLong(offset)) as P;
    case 5:
      return (reader.readLong(offset)) as P;
    case 6:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _recurringExpenseModelGetId(RecurringExpenseModel object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _recurringExpenseModelGetLinks(
    RecurringExpenseModel object) {
  return [];
}

void _recurringExpenseModelAttach(
    IsarCollection<dynamic> col, Id id, RecurringExpenseModel object) {
  object.id = id;
}

extension RecurringExpenseModelQueryWhereSort
    on QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QWhere> {
  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterWhere>
      anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }
}

extension RecurringExpenseModelQueryWhere on QueryBuilder<RecurringExpenseModel,
    RecurringExpenseModel, QWhereClause> {
  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterWhereClause>
      idEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterWhereClause>
      idNotEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            )
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            );
      } else {
        return query
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            )
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            );
      }
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterWhereClause>
      idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterWhereClause>
      idLessThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterWhereClause>
      idBetween(
    Id lowerId,
    Id upperId, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: lowerId,
        includeLower: includeLower,
        upper: upperId,
        includeUpper: includeUpper,
      ));
    });
  }
}

extension RecurringExpenseModelQueryFilter on QueryBuilder<
    RecurringExpenseModel, RecurringExpenseModel, QFilterCondition> {
  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> amountEqualTo(
    double value, {
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'amount',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> amountGreaterThan(
    double value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'amount',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> amountLessThan(
    double value, {
    bool include = false,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'amount',
        value: value,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> amountBetween(
    double lower,
    double upper, {
    bool includeLower = true,
    bool includeUpper = true,
    double epsilon = Query.epsilon,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'amount',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        epsilon: epsilon,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> categoryIdEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'categoryId',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> categoryIdGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'categoryId',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> categoryIdLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'categoryId',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> categoryIdBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'categoryId',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> dayOfMonthEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'dayOfMonth',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> dayOfMonthGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'dayOfMonth',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> dayOfMonthLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'dayOfMonth',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> dayOfMonthBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'dayOfMonth',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> idEqualTo(Id value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> idGreaterThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> idLessThan(
    Id value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'id',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> idBetween(
    Id lower,
    Id upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'id',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> isActiveEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'isActive',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> lastRegisteredMonthEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lastRegisteredMonth',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> lastRegisteredMonthGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'lastRegisteredMonth',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> lastRegisteredMonthLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'lastRegisteredMonth',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> lastRegisteredMonthBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'lastRegisteredMonth',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> lastRegisteredYearEqualTo(int value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'lastRegisteredYear',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> lastRegisteredYearGreaterThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'lastRegisteredYear',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> lastRegisteredYearLessThan(
    int value, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'lastRegisteredYear',
        value: value,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> lastRegisteredYearBetween(
    int lower,
    int upper, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'lastRegisteredYear',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> nameEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> nameGreaterThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        include: include,
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> nameLessThan(
    String value, {
    bool include = false,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.lessThan(
        include: include,
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> nameBetween(
    String lower,
    String upper, {
    bool includeLower = true,
    bool includeUpper = true,
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.between(
        property: r'name',
        lower: lower,
        includeLower: includeLower,
        upper: upper,
        includeUpper: includeUpper,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> nameStartsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.startsWith(
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> nameEndsWith(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.endsWith(
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
          QAfterFilterCondition>
      nameContains(String value, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.contains(
        property: r'name',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
          QAfterFilterCondition>
      nameMatches(String pattern, {bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.matches(
        property: r'name',
        wildcard: pattern,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> nameIsEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'name',
        value: '',
      ));
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel,
      QAfterFilterCondition> nameIsNotEmpty() {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.greaterThan(
        property: r'name',
        value: '',
      ));
    });
  }
}

extension RecurringExpenseModelQueryObject on QueryBuilder<
    RecurringExpenseModel, RecurringExpenseModel, QFilterCondition> {}

extension RecurringExpenseModelQueryLinks on QueryBuilder<RecurringExpenseModel,
    RecurringExpenseModel, QFilterCondition> {}

extension RecurringExpenseModelQuerySortBy
    on QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QSortBy> {
  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'amount', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'amount', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByCategoryId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'categoryId', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByCategoryIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'categoryId', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByDayOfMonth() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dayOfMonth', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByDayOfMonthDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dayOfMonth', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByIsActive() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isActive', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByIsActiveDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isActive', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByLastRegisteredMonth() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastRegisteredMonth', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByLastRegisteredMonthDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastRegisteredMonth', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByLastRegisteredYear() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastRegisteredYear', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByLastRegisteredYearDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastRegisteredYear', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      sortByNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.desc);
    });
  }
}

extension RecurringExpenseModelQuerySortThenBy
    on QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QSortThenBy> {
  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'amount', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByAmountDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'amount', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByCategoryId() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'categoryId', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByCategoryIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'categoryId', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByDayOfMonth() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dayOfMonth', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByDayOfMonthDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'dayOfMonth', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenById() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByIdDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'id', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByIsActive() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isActive', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByIsActiveDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'isActive', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByLastRegisteredMonth() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastRegisteredMonth', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByLastRegisteredMonthDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastRegisteredMonth', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByLastRegisteredYear() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastRegisteredYear', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByLastRegisteredYearDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'lastRegisteredYear', Sort.desc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByName() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.asc);
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QAfterSortBy>
      thenByNameDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'name', Sort.desc);
    });
  }
}

extension RecurringExpenseModelQueryWhereDistinct
    on QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QDistinct> {
  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QDistinct>
      distinctByAmount() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'amount');
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QDistinct>
      distinctByCategoryId() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'categoryId');
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QDistinct>
      distinctByDayOfMonth() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'dayOfMonth');
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QDistinct>
      distinctByIsActive() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'isActive');
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QDistinct>
      distinctByLastRegisteredMonth() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'lastRegisteredMonth');
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QDistinct>
      distinctByLastRegisteredYear() {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'lastRegisteredYear');
    });
  }

  QueryBuilder<RecurringExpenseModel, RecurringExpenseModel, QDistinct>
      distinctByName({bool caseSensitive = true}) {
    return QueryBuilder.apply(this, (query) {
      return query.addDistinctBy(r'name', caseSensitive: caseSensitive);
    });
  }
}

extension RecurringExpenseModelQueryProperty on QueryBuilder<
    RecurringExpenseModel, RecurringExpenseModel, QQueryProperty> {
  QueryBuilder<RecurringExpenseModel, int, QQueryOperations> idProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'id');
    });
  }

  QueryBuilder<RecurringExpenseModel, double, QQueryOperations>
      amountProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'amount');
    });
  }

  QueryBuilder<RecurringExpenseModel, int, QQueryOperations>
      categoryIdProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'categoryId');
    });
  }

  QueryBuilder<RecurringExpenseModel, int, QQueryOperations>
      dayOfMonthProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'dayOfMonth');
    });
  }

  QueryBuilder<RecurringExpenseModel, bool, QQueryOperations>
      isActiveProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'isActive');
    });
  }

  QueryBuilder<RecurringExpenseModel, int, QQueryOperations>
      lastRegisteredMonthProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'lastRegisteredMonth');
    });
  }

  QueryBuilder<RecurringExpenseModel, int, QQueryOperations>
      lastRegisteredYearProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'lastRegisteredYear');
    });
  }

  QueryBuilder<RecurringExpenseModel, String, QQueryOperations> nameProperty() {
    return QueryBuilder.apply(this, (query) {
      return query.addPropertyName(r'name');
    });
  }
}
