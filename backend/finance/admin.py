from django.contrib import admin

from .models import (
    CommitmentItem,
    ExpenseCategory,
    ExpenseEntry,
    FinancialPeriod,
    GuestProfile,
    IncomeEntry,
    IncomeCoverage,
    IncomeImportBatch,
    IncomeImportRow,
    IncomeSource,
    WorkCostItem,
)


admin.site.register(GuestProfile)
admin.site.register(IncomeSource)
admin.site.register(FinancialPeriod)
admin.site.register(IncomeEntry)
admin.site.register(IncomeCoverage)
admin.site.register(WorkCostItem)
admin.site.register(CommitmentItem)
admin.site.register(ExpenseCategory)
admin.site.register(ExpenseEntry)
admin.site.register(IncomeImportBatch)
admin.site.register(IncomeImportRow)
